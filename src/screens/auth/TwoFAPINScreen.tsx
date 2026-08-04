import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNetworkError } from '@/src/api/client';
import PINDots from '@/src/components/PINDots';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';

// Second factor at login. The password already passed; until the correct PIN
// is entered the app holds only a 5-minute temp token — no JWT, no session —
// so there is nothing here to skip past. Backing out returns to Login.
export default function TwoFAPINScreen() {
  const params = useLocalSearchParams<{ tempToken?: string; email?: string }>();
  const tempToken = params.tempToken ?? '';
  const email = params.email ?? '';
  const { completeTwoFactor } = useAuth();

  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const inputRef = useRef<TextInput>(null);
  const submittedRef = useRef(false);

  const locked = lockedUntil !== null;

  // Hardware back would otherwise drop the user onto whatever is beneath this
  // screen while half-authenticated. Send them to Login deliberately instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(auth)/login');
      return true;
    });
    return () => sub.remove();
  }, []);

  // Live countdown while locked out.
  useEffect(() => {
    if (!lockedUntil) return undefined;
    const tick = () => {
      const diff = lockedUntil.getTime() - Date.now();
      if (diff <= 0) {
        setLockedUntil(null);
        setTimeLeft('');
        setError(null);
        setPin('');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${String(secs).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const submit = useCallback(
    async (value: string) => {
      if (submittedRef.current || locked || !tempToken) return;
      submittedRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        const user = await completeTwoFactor(value, tempToken);
        // Same post-login routing as the no-2FA path: an unverified email still
        // has to be cleared before the dashboard is reachable.
        if (user.emailVerified === false) {
          router.replace({
            pathname: '/(auth)/verify-email',
            params: { email: user.email, name: user.name },
          });
        } else {
          router.replace('/(tabs)');
        }
      } catch (err) {
        setPin('');
        submittedRef.current = false;
        const res = (err as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
        const code = res?.data?.error;

        if (code === 'ACCOUNT_LOCKED') {
          const until = res?.data?.locked_until;
          setLockedUntil(until ? new Date(String(until)) : new Date(Date.now() + 30 * 60 * 1000));
          setError('Too many wrong attempts. Your account is locked.');
        } else if (code === 'WRONG_PIN') {
          setError(String(res?.data?.message ?? 'Incorrect PIN.'));
          inputRef.current?.focus();
        } else if (code === 'INVALID_TEMP_TOKEN') {
          setError('Your login session expired. Please log in again.');
        } else if (isNetworkError(err)) {
          setError('Cannot reach the server. Check your connection and try again.');
          inputRef.current?.focus();
        } else {
          setError(String(res?.data?.message ?? 'Something went wrong. Please try again.'));
          inputRef.current?.focus();
        }
      } finally {
        setSubmitting(false);
      }
    },
    [completeTwoFactor, locked, tempToken],
  );

  // Auto-submit on the 6th digit, exactly like the WhatsApp PIN prompt.
  const onChange = (text: string) => {
    if (locked || submitting) return;
    if (!/^\d*$/.test(text)) return;
    const next = text.slice(0, 6);
    setPin(next);
    if (error) setError(null);
    if (next.length === 6) submit(next);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="shield-lock-outline" size={34} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Enter your security PIN</Text>
        <Text style={styles.subtitle}>
          Two-step verification is on for{'\n'}
          <Text style={styles.email}>{email || 'your account'}</Text>
        </Text>

        {locked ? (
          <View style={styles.lockedBox}>
            <MaterialCommunityIcons name="lock-clock" size={38} color={Colors.danger} />
            <Text style={styles.lockedTitle}>Account temporarily locked</Text>
            <Text style={styles.lockedTime}>{timeLeft}</Text>
            <Text style={styles.lockedNote}>
              Too many wrong PINs. You can try again when the timer ends, or reset your PIN with your
              password.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
              <PINDots length={pin.length} error={Boolean(error)} />
            </TouchableOpacity>

            {/* Off-screen field: the dots above are the visible control. */}
            <TextInput
              ref={inputRef}
              value={pin}
              onChangeText={onChange}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              editable={!submitting}
              style={styles.hiddenInput}
              // Never offer to save a security PIN to the keyboard/clipboard.
              autoComplete="off"
              autoCorrect={false}
              textContentType="oneTimeCode"
            />

            <TouchableOpacity style={styles.tapToType} onPress={() => inputRef.current?.focus()}>
              <MaterialCommunityIcons name="keyboard-outline" size={15} color={Colors.textSecondary} />
              <Text style={styles.tapToTypeText}>Tap to enter PIN</Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {submitting ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 14 }} /> : null}
          </>
        )}

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() =>
            router.push({ pathname: '/(auth)/reset-pin', params: { tempToken, email } })
          }
        >
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.backText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 34 },
  email: { color: Colors.primary, fontWeight: '700' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  tapToType: {
    flexDirection: 'row',
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
    maxWidth: 320,
  },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  lockedBox: {
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    borderRadius: 14,
    padding: 24,
    width: '100%',
    gap: 8,
  },
  lockedTitle: { fontSize: 16, fontWeight: '800', color: Colors.danger },
  lockedTime: { fontSize: 32, fontWeight: '800', color: Colors.danger, letterSpacing: 1 },
  lockedNote: { fontSize: 12.5, color: Colors.danger, textAlign: 'center', lineHeight: 18 },
  forgotButton: { paddingVertical: 14, marginTop: 26 },
  forgotText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  backButton: { paddingVertical: 8 },
  backText: { color: Colors.textSecondary, fontSize: 14 },
});
