import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNetworkError } from '@/src/api/client';
import { resetTwoFAPin } from '@/src/api/twoFA';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';

// "Forgot PIN" — the account password is the proof of ownership.
//
// Reachable from two places, which is why tempToken is optional:
//   • Settings → Security (user is logged in; the JWT goes automatically)
//   • the login PIN prompt (no session yet — tempToken identifies them)
// Without the second path, a locked-out user could never recover, because the
// only route back in would be the PIN they've forgotten.
export default function ResetPINScreen() {
  const params = useLocalSearchParams<{ tempToken?: string; email?: string }>();
  const tempToken = params.tempToken || undefined;
  const fromLogin = Boolean(tempToken);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    password.length >= 4 && /^\d{6}$/.test(newPin) && /^\d{6}$/.test(confirmPin) && !submitting;

  const handleReset = async () => {
    if (!canSubmit) return;
    if (newPin !== confirmPin) {
      setError('New PINs do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetTwoFAPin(password, newPin, confirmPin, tempToken);
      showToast('Your PIN has been reset');
      // From login the user must now enter the new PIN; the old temp token was
      // consumed, so send them back to a clean login rather than the prompt.
      router.replace(fromLogin ? '/(auth)/login' : '/settings/security');
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Cannot reach the server. Please try again.'
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Could not reset your PIN. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset PIN</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="lock-reset" size={22} color={Colors.primary} />
            <Text style={styles.infoText}>
              Confirm your account password to set a new 6-digit PIN. This also clears any lockout.
            </Text>
          </View>

          <Text style={styles.label}>Account password</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              placeholder="Enter your password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>New 6-digit PIN</Text>
          <TextInput
            value={newPin}
            onChangeText={(t) => {
              if (/^\d*$/.test(t)) {
                setNewPin(t.slice(0, 6));
                setError(null);
              }
            }}
            placeholder="••••••"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            style={styles.pinInput}
            autoComplete="off"
            textContentType="oneTimeCode"
          />

          <Text style={styles.label}>Confirm new PIN</Text>
          <TextInput
            value={confirmPin}
            onChangeText={(t) => {
              if (/^\d*$/.test(t)) {
                setConfirmPin(t.slice(0, 6));
                setError(null);
              }
            }}
            placeholder="••••••"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            style={styles.pinInput}
            autoComplete="off"
            textContentType="oneTimeCode"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            disabled={!canSubmit}
            onPress={handleReset}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonLabel}>Reset PIN</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  container: { padding: 24, paddingBottom: 40 },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 26,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.primaryDark, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: Colors.textPrimary },
  pinInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    letterSpacing: 8,
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 22,
  },
  errorText: { color: Colors.danger, fontSize: 13, marginBottom: 16, lineHeight: 19 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { backgroundColor: Colors.textMuted },
  buttonLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
