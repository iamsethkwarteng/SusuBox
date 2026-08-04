import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { disableTwoFA } from '@/src/api/twoFA';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { patchAuthUser } from '@/src/hooks/useAuth';

// Turning the second factor OFF is the most security-sensitive action here, so
// it demands BOTH the password and the current PIN — a borrowed unlocked phone
// (has the session, not the password) and a leaked password (no PIN) each fail.
export default function Disable2FAScreen() {
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = password.length >= 4 && /^\d{6}$/.test(pin) && !submitting;

  const handleDisable = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await disableTwoFA(pin, password);
      patchAuthUser({ twoFaEnabled: false });
      showToast('Two-step verification disabled');
      router.back();
    } catch (err) {
      setPin('');
      setError(
        isNetworkError(err)
          ? 'Cannot reach the server. Please try again.'
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Could not disable two-step verification.'),
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
        <Text style={styles.headerTitle}>Disable 2FA</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.warningBox}>
            <MaterialCommunityIcons name="shield-alert-outline" size={22} color={Colors.danger} />
            <Text style={styles.warningText}>
              Turning this off means your password alone will unlock your account. Anyone who learns it
              can reach your savings and your group&apos;s money.
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

          <Text style={styles.label}>Current 6-digit PIN</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => {
              if (/^\d*$/.test(t)) {
                setPin(t.slice(0, 6));
                setError(null);
              }
            }}
            placeholder="••••••"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            style={[styles.input, styles.pinInput]}
            autoComplete="off"
            textContentType="oneTimeCode"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.dangerButton, !canSubmit && styles.dangerButtonDisabled]}
            disabled={!canSubmit}
            onPress={handleDisable}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.dangerLabel}>Disable two-step verification</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelLabel}>Keep it on</Text>
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
  warningBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.dangerLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
  },
  warningText: { flex: 1, fontSize: 13, color: Colors.danger, lineHeight: 19 },
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
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    letterSpacing: 8,
    fontSize: 18,
    marginBottom: 22,
  },
  errorText: { color: Colors.danger, fontSize: 13, marginBottom: 16, lineHeight: 19 },
  dangerButton: {
    backgroundColor: Colors.danger,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  dangerButtonDisabled: { backgroundColor: Colors.textMuted },
  dangerLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  cancelButton: { paddingVertical: 16, alignItems: 'center' },
  cancelLabel: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
});
