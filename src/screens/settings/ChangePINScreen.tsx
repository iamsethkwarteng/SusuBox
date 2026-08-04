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
import { changeTwoFAPin } from '@/src/api/twoFA';
import PINDots from '@/src/components/PINDots';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';

type Phase = 'current' | 'new' | 'confirm';

const COPY: Record<Phase, { title: string; subtitle: string }> = {
  current: { title: 'Enter your current PIN', subtitle: 'Confirm it’s really you.' },
  new: { title: 'Choose a new PIN', subtitle: 'Pick 6 digits you will remember.' },
  confirm: { title: 'Confirm your new PIN', subtitle: 'Enter the same 6 digits again.' },
};

// Three PIN entries in sequence: current → new → confirm. The current PIN is
// checked server-side, so a wrong one fails at submit rather than leaking
// which step was wrong early.
export default function ChangePINScreen() {
  const [phase, setPhase] = useState<Phase>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const value = phase === 'current' ? currentPin : phase === 'new' ? newPin : confirmPin;

  const restart = (message: string, to: Phase = 'current') => {
    setError(message);
    setCurrentPin(to === 'current' ? '' : currentPin);
    setNewPin('');
    setConfirmPin('');
    setPhase(to);
    inputRef.current?.focus();
  };

  const submit = async (confirmValue: string) => {
    if (newPin !== confirmValue) {
      restart('New PINs do not match. Please choose again.', 'new');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await changeTwoFAPin(currentPin, newPin, confirmValue);
      showToast('Your PIN has been updated');
      router.back();
    } catch (err) {
      const res = (err as { response?: { data?: { error?: string; message?: string } } })?.response;
      const message = isNetworkError(err)
        ? 'Cannot reach the server. Please try again.'
        : (res?.data?.message ?? 'Could not change your PIN. Please try again.');
      // A wrong CURRENT pin means starting over; anything else only invalidates
      // the new PIN the user just chose.
      restart(message, res?.data?.error === 'WRONG_PIN' ? 'current' : 'new');
    } finally {
      setSubmitting(false);
    }
  };

  const onChange = (text: string) => {
    if (submitting || !/^\d*$/.test(text)) return;
    const next = text.slice(0, 6);
    if (error) setError(null);

    if (phase === 'current') {
      setCurrentPin(next);
      if (next.length === 6) setTimeout(() => setPhase('new'), 180);
    } else if (phase === 'new') {
      setNewPin(next);
      if (next.length === 6) setTimeout(() => setPhase('confirm'), 180);
    } else {
      setConfirmPin(next);
      if (next.length === 6) submit(next);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change PIN</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>{COPY[phase].title}</Text>
        <Text style={styles.subtitle}>{COPY[phase].subtitle}</Text>

        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
          <PINDots length={value.length} error={Boolean(error)} />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          value={value}
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
  subtitle: { fontSize: 14.5, color: Colors.textSecondary, textAlign: 'center', marginBottom: 34 },
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
});
