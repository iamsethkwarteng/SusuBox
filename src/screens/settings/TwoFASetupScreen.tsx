import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNetworkError } from '@/src/api/client';
import { setupTwoFA } from '@/src/api/twoFA';
import PINDots from '@/src/components/PINDots';
import { Colors } from '@/src/constants/colors';
import { patchAuthUser } from '@/src/hooks/useAuth';

type Phase = 'enter' | 'confirm' | 'success';

// WhatsApp-style enable flow: choose a PIN, retype it, done. The PIN is held in
// component state only for the moment it takes to post it — it is never written
// to SecureStore or logged, and the server keeps only a bcrypt hash.
export default function TwoFASetupScreen() {
  const [phase, setPhase] = useState<Phase>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const current = phase === 'enter' ? pin : confirmPin;

  const restart = (message: string) => {
    setError(message);
    setPin('');
    setConfirmPin('');
    setPhase('enter');
    inputRef.current?.focus();
  };

  const submit = async (firstPin: string, secondPin: string) => {
    if (firstPin !== secondPin) {
      restart('PINs do not match. Please start again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await setupTwoFA(firstPin, secondPin);
      // Keep the cached user in step so Settings shows ON without a refetch.
      patchAuthUser({ twoFaEnabled: true });
      setPhase('success');
    } catch (err) {
      const message = isNetworkError(err)
        ? 'Cannot reach the server. Please try again.'
        : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Setup failed. Please try again.');
      restart(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onChange = (text: string) => {
    if (submitting || !/^\d*$/.test(text)) return;
    const next = text.slice(0, 6);
    if (error) setError(null);

    if (phase === 'enter') {
      setPin(next);
      // Advance to confirmation once six digits are in.
      if (next.length === 6) setTimeout(() => setPhase('confirm'), 180);
    } else {
      setConfirmPin(next);
      if (next.length === 6) submit(pin, next);
    }
  };

  if (phase === 'success') {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.successCircle}>
            <MaterialCommunityIcons name="shield-check" size={52} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Two-step verification active</Text>
          <Text style={styles.successBody}>
            Your account is now protected with a 6-digit PIN. You&apos;ll be asked for it every time you
            log in — even if someone knows your password.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.doneLabel}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set up PIN</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>
          {phase === 'enter' ? 'Create your security PIN' : 'Confirm your PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {phase === 'enter'
            ? 'Choose a 6-digit PIN you will remember.\nDo not share it with anyone.'
            : 'Enter the same 6 digits again.'}
        </Text>

        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
          <PINDots length={current.length} error={Boolean(error)} />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          value={current}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          editable={!submitting}
          style={styles.hiddenInput}
          autoComplete="off"
          autoCorrect={false}
          textContentType="oneTimeCode"
        />

        <TouchableOpacity style={styles.tapToType} onPress={() => inputRef.current?.focus()}>
          <MaterialCommunityIcons name="keyboard-outline" size={15} color={Colors.textSecondary} />
          <Text style={styles.tapToTypeText}>Tap to enter PIN</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {submitting ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 14 }} /> : null}

        <View style={styles.warningBox}>
          <MaterialCommunityIcons name="alert-outline" size={17} color={Colors.warning} />
          <Text style={styles.warningText}>
            If you forget this PIN you&apos;ll need your account password to reset it. Keep it somewhere
            safe.
          </Text>
        </View>
      </View>
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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 21, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  subtitle: {
    fontSize: 14.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 34,
  },
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
    marginTop: 22,
  },
  tapToTypeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 19,
    maxWidth: 320,
  },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 36,
  },
  warningText: { flex: 1, fontSize: 12.5, color: Colors.warning, lineHeight: 18 },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.success,
    textAlign: 'center',
    marginBottom: 10,
  },
  successBody: {
    fontSize: 14.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 26,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 56,
  },
  doneLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
