import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestPasswordReset } from '@/src/api/auth';
import { isNetworkError } from '@/src/api/client';
import { Colors } from '@/src/constants/colors';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && email.includes('@') && !submitting;

  const backToLogin = () => router.replace('/(auth)/login');

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      // Shown for ANY successful call. The backend deliberately answers the
      // same way whether or not the address is registered, so branching here
      // would reintroduce the account enumeration it exists to prevent — the
      // screen must not know something the API refused to tell it.
      setSent(true);
    } catch (err) {
      // Only genuine failures surface: no network, or the rate limiter. A 200
      // is always the neutral message above.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (isNetworkError(err)) {
        setError('Could not reach the server. Check your connection and try again.');
      } else if (status === 429) {
        setError(
          'Too many reset requests for this email. Please wait an hour, and check your spam folder — a link may already be waiting.',
        );
      } else {
        setError('Could not send the reset link. Please try again in a moment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.confirmWrap}>
          <View style={styles.confirmIcon}>
            <MaterialCommunityIcons name="email-check-outline" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.confirmTitle}>Check your email</Text>
          {/* Says "if an account exists" for the same reason the API does. */}
          <Text style={styles.confirmBody}>
            If an account exists for{'\n'}
            <Text style={styles.confirmEmail}>{email.trim().toLowerCase()}</Text>
            {'\n'}we have sent a link to reset your password.
          </Text>
          <View style={styles.hintCard}>
            <MaterialCommunityIcons name="information-outline" size={17} color={Colors.primaryDark} />
            <Text style={styles.hintText}>
              The link expires in 1 hour and can only be used once. If it is not in your inbox,
              check your spam folder.
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={backToLogin} activeOpacity={0.85}>
            <Text style={styles.buttonLabel}>Back to login</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSent(false)} hitSlop={8}>
            <Text style={styles.secondaryLink}>Use a different email</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={backToLogin} hitSlop={10} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.logoBox}>
            <MaterialCommunityIcons name="lock-reset" size={30} color={Colors.white} />
          </View>

          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.subtitle}>
            Enter the email address on your account and we&apos;ll send you a link to set a new
            password.
          </Text>

          <TextInput
            mode="outlined"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            left={<TextInput.Icon icon="email-outline" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonLabel}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Remembered it? </Text>
            <TouchableOpacity onPress={backToLogin} hitSlop={8}>
              <Text style={styles.footerLink}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 16 },
  backButton: { marginBottom: 16 },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: 28,
    lineHeight: 20,
  },
  input: { backgroundColor: Colors.surface, marginBottom: 16 },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 12, lineHeight: 19 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: Colors.textSecondary },
  footerLink: { fontSize: 14, color: Colors.primary, fontWeight: '700' },

  // Confirmation state.
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  confirmIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  confirmTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  confirmBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  confirmEmail: { color: Colors.textPrimary, fontWeight: '700' },
  hintCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  hintText: { flex: 1, fontSize: 12.5, color: Colors.primaryDark, lineHeight: 18 },
  secondaryLink: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 4 },
});
