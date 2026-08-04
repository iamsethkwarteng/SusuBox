import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getVerificationStatus, resendVerificationEmail } from '@/src/api/auth';
import { Colors } from '@/src/constants/colors';
import { patchAuthUser, useAuth } from '@/src/hooks/useAuth';

const POLL_INTERVAL_MS = 5000;
const RESEND_COOLDOWN_S = 60;

// Shown immediately after Create Account on step 4 of registration, and again on
// login / app reopen while the account is still unverified. The account exists
// and is logged in at this point, but every protected route returns 403
// EMAIL_NOT_VERIFIED until the link in the user's inbox is opened — so an
// address the user cannot actually read leaves the account unusable.
export default function EmailVerificationScreen() {
  const params = useLocalSearchParams<{ email?: string; name?: string }>();
  const { user, logout } = useAuth();

  // Params win (they carry the address just registered); the cached auth user is
  // the fallback when the client interceptor redirected here without them.
  const email = params.email || user?.email || 'your email address';
  const name = params.name || user?.name || '';

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_S);
  const [verified, setVerified] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatedRef = useRef(false);

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

  // Android hardware back must not escape this screen — it is the only thing
  // standing between an unverified account and the dashboard.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Poll for the flip made server-side when the browser opens the link.
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const { emailVerified } = await getVerificationStatus();
        if (!emailVerified || navigatedRef.current) return;

        navigatedRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        // Keep the in-memory auth user in step so nothing re-redirects here.
        patchAuthUser({ emailVerified: true });
        setVerified(true);
        setTimeout(() => router.replace('/(tabs)'), 1500);
      } catch {
        // Offline or a transient 5xx — keep polling.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      await resendVerificationEmail();
      setResent(true);
      startCountdown();
      Alert.alert(
        'Email sent',
        `A new verification link has been sent to ${email}. Please check your inbox and spam folder.`,
      );
    } catch (err) {
      Alert.alert(
        'Could not resend',
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Please try again in a moment.',
      );
    } finally {
      setResending(false);
    }
  };

  const handleStartOver = () => {
    Alert.alert('Start over?', 'You will need to fill in your details again. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, start over',
        style: 'destructive',
        onPress: async () => {
          if (pollRef.current) clearInterval(pollRef.current);
          await logout();
          router.replace('/(auth)/register');
        },
      },
    ]);
  };

  if (verified) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <View style={styles.successCircle}>
            <MaterialCommunityIcons name="check-circle" size={56} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Email verified!</Text>
          <Text style={styles.successSubtitle}>
            {name ? `Welcome to SusuBox, ${name}!` : 'Welcome to SusuBox!'}
          </Text>
          <Text style={styles.successNote}>Taking you to your dashboard…</Text>
          <ActivityIndicator color={Colors.primary} size="small" style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="email-outline" size={40} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a verification link to</Text>
        <Text style={styles.email}>{email}</Text>

        <Text style={styles.instruction}>
          Tap the link in the email to activate your SusuBox account. This screen updates
          automatically once you do.
        </Text>

        <View style={styles.waitingRow}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.waitingText}>Waiting for verification…</Text>
        </View>

        {resent ? (
          <View style={styles.resentBanner}>
            <MaterialCommunityIcons name="check" size={16} color={Colors.success} />
            <Text style={styles.resentText}>Verification email resent</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.resendButton, (countdown > 0 || resending) && styles.resendButtonDisabled]}
          onPress={handleResend}
          disabled={countdown > 0 || resending}
          activeOpacity={0.75}
        >
          {resending ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
              {countdown > 0 ? `Resend email in ${countdown}s` : 'Resend verification email'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.startOverButton} onPress={handleStartOver} activeOpacity={0.7}>
          <Text style={styles.startOverText}>Wrong email address? Start over</Text>
        </TouchableOpacity>

        <View style={styles.tipsBox}>
          <Text style={styles.tipsTitle}>Email not arriving?</Text>
          <Text style={styles.tipItem}>• Check your spam or junk folder</Text>
          <Text style={styles.tipItem}>• Make sure you entered the correct email</Text>
          <Text style={styles.tipItem}>• Wait up to 2 minutes for it to arrive</Text>
          <Text style={styles.tipItem}>• Tap Resend if it still hasn&apos;t arrived</Text>
          <Text style={styles.tipItem}>• Try a different email address if the problem continues</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingVertical: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  email: { fontSize: 16, fontWeight: '700', color: Colors.primary, textAlign: 'center', marginBottom: 20 },
  instruction: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  waitingText: { fontSize: 13, color: Colors.textSecondary },
  resentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.successLight,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginBottom: 16,
    width: '100%',
  },
  resentText: { color: Colors.success, fontWeight: '600', fontSize: 13.5 },
  resendButton: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 10,
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendButtonDisabled: { borderColor: Colors.border },
  resendText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  resendTextDisabled: { color: Colors.textMuted },
  startOverButton: { paddingVertical: 12, marginBottom: 26 },
  startOverText: { color: Colors.textSecondary, fontSize: 14, textDecorationLine: 'underline' },
  tipsBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    width: '100%',
  },
  tipsTitle: { fontWeight: '800', color: Colors.textPrimary, marginBottom: 10, fontSize: 14 },
  tipItem: { color: Colors.textSecondary, fontSize: 13, lineHeight: 23 },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: Colors.success, marginBottom: 8 },
  successSubtitle: { fontSize: 16, color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  successNote: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
