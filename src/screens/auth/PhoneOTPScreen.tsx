import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { isNetworkError } from '@/src/api/client';
import { resendPhoneOtp, verifyPhoneOtp } from '@/src/api/otp';
import PINDots from '@/src/components/PINDots';
import { Colors } from '@/src/constants/colors';

const RESEND_COOLDOWN_S = 60;

interface PhoneOTPScreenProps {
  phone: string;
  /** Receives the single-use token the registration call must carry. */
  onVerified: (token: string) => void;
  onBack: () => void;
}

// Sits between registration step 1 and step 2. Rendered *inside* RegisterScreen
// rather than as its own route so the step header/progress stays continuous and
// the half-filled form is never unmounted.
export default function PhoneOTPScreen({ phone, onVerified, onBack }: PhoneOTPScreenProps) {
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_S);
  // Set when the backend reports the code is spent (expired, not found, or the
  // 3-attempt limit hit). Skips the remaining cooldown so the only useful
  // action is immediately available.
  const [forceResend, setForceResend] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const submittedRef = useRef(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN_S);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startCountdown();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [startCountdown]);

  const submit = useCallback(
    async (code: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        const token = await verifyPhoneOtp(phone, code);
        onVerified(token);
      } catch (err) {
        setOtp('');
        submittedRef.current = false;
        const data = (
          err as {
            response?: {
              data?: {
                message?: string;
                attempts_remaining?: number;
                request_new_code?: boolean;
              };
            };
          }
        )?.response?.data;

        if (isNetworkError(err)) {
          setError('Cannot reach the server. Check your connection and try again.');
        } else {
          // Vynfy allows 3 attempts per code and then the code is dead. When
          // the backend says so, unlock Resend straight away rather than
          // leaving the user to keep retyping a code that can never work.
          if (data?.request_new_code) setForceResend(true);

          const remaining = data?.attempts_remaining;
          const base = data?.message ?? 'Incorrect code. Please try again.';
          setError(
            typeof remaining === 'number' && remaining > 0
              ? `${base} ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
              : base,
          );
        }
        inputRef.current?.focus();
      } finally {
        setSubmitting(false);
      }
    },
    [onVerified, phone],
  );

  // Auto-submit on the 6th digit.
  const onChange = (text: string) => {
    if (submitting || !/^\d*$/.test(text)) return;
    const next = text.slice(0, 6);
    setOtp(next);
    if (error) setError(null);
    if (next.length === 6) submit(next);
  };

  const handleResend = async () => {
    // forceResend overrides the cooldown: the current code is already dead,
    // so making the user wait out a timer serves no purpose.
    if ((countdown > 0 && !forceResend) || resending) return;
    setResending(true);
    setError(null);
    try {
      await resendPhoneOtp(phone);
      setOtp('');
      submittedRef.current = false;
      // Clear the override — there is a live code again, so the cooldown
      // applies once more. Without this, resend would stay permanently
      // unlocked and could be spammed at Vynfy (and at your SMS bill).
      setForceResend(false);
      startCountdown();
      Alert.alert('Code sent', 'A new verification code has been sent to your phone.');
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(data?.message ?? 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Resend is blocked only while the cooldown is running AND the current code
  // could still work. Once the backend says the code is spent, the cooldown is
  // irrelevant — resending is the only path forward.
  const resendLocked = countdown > 0 && !forceResend;

  // 024****789 — recognisable to its owner, not readable over their shoulder.
  const maskedPhone = phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : phone;

  return (
    <View>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="cellphone-message" size={34} color={Colors.primary} />
      </View>

      <Text style={styles.title}>Verify your phone</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to{'\n'}
        <Text style={styles.phone}>{maskedPhone}</Text>
      </Text>

      <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
        <PINDots length={otp.length} error={Boolean(error)} />
      </TouchableOpacity>

      {/* Off-screen field — the dots above are the visible control. */}
      <TextInput
        ref={inputRef}
        value={otp}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        editable={!submitting}
        style={styles.hiddenInput}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        autoCorrect={false}
      />

      <TouchableOpacity style={styles.tapToType} onPress={() => inputRef.current?.focus()}>
        <MaterialCommunityIcons name="keyboard-outline" size={15} color={Colors.textSecondary} />
        <Text style={styles.tapToTypeText}>Tap to enter code</Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {submitting ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 14 }} /> : null}

      <TouchableOpacity
        style={[styles.resendButton, (resendLocked || resending) && styles.resendDisabled]}
        onPress={handleResend}
        disabled={resendLocked || resending}
        activeOpacity={0.75}
      >
        {resending ? (
          <ActivityIndicator color={Colors.primary} size="small" />
        ) : (
          <Text style={[styles.resendText, resendLocked && styles.resendTextDisabled]}>
            {resendLocked ? `Resend code in ${countdown}s` : 'Resend code'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.tipsBox}>
        <Text style={styles.tipsTitle}>Code not arriving?</Text>
        <Text style={styles.tipItem}>• Check all your SMS messages</Text>
        <Text style={styles.tipItem}>• The code is valid for 10 minutes</Text>
        <Text style={styles.tipItem}>• Make sure {maskedPhone} is correct</Text>
        <Text style={styles.tipItem}>• Tap Resend if nothing arrives after a minute</Text>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
        <MaterialCommunityIcons name="arrow-left" size={16} color={Colors.textSecondary} />
        <Text style={styles.backText}>Change phone number</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  phone: { color: Colors.primary, fontWeight: '700' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  tapToType: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 20,
  },
  tapToTypeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  resendButton: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 22,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendDisabled: { borderColor: Colors.border },
  resendText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  resendTextDisabled: { color: Colors.textMuted },
  tipsBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginTop: 22,
  },
  tipsTitle: { fontWeight: '800', color: Colors.textPrimary, marginBottom: 8, fontSize: 13.5 },
  tipItem: { color: Colors.textSecondary, fontSize: 12.5, lineHeight: 22 },
  backButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  backText: { color: Colors.textSecondary, fontSize: 14, textDecorationLine: 'underline' },
});
