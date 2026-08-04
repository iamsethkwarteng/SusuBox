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
import { saveMoMoDetails } from '@/src/api/payments';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { patchAuthUser, useAuth } from '@/src/hooks/useAuth';
import type { MoMoNetwork } from '@/src/types';

interface NetworkOption {
  key: MoMoNetwork;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}

const NETWORKS: NetworkOption[] = [
  { key: 'MTN', label: 'MTN MoMo', icon: 'cellphone', color: '#F5B700' },
  { key: 'Vodafone', label: 'Vodafone Cash', icon: 'cellphone', color: '#E60000' },
  { key: 'AirtelTigo', label: 'AirtelTigo Money', icon: 'cellphone', color: '#0A6EC9' },
];

const isValidNumber = (n: string) => /^0\d{9}$/.test(n);

export default function MoMoSetupScreen() {
  const { user } = useAuth();
  const [network, setNetwork] = useState<MoMoNetwork | null>(user?.momoNetwork ?? null);
  const [number, setNumber] = useState(user?.momoNumber ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numberValid = isValidNumber(number);
  const canSave = numberValid && !!network && !saving;

  const handleSave = async () => {
    if (!canSave || !network) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveMoMoDetails(number, network);
      // Reflect the saved details in the shared auth store immediately.
      patchAuthUser({ momoNumber: number, momoNetwork: network, payoutReady: result.payoutReady });
      showToast('Payout account saved ✓');
      router.back();
    } catch (err) {
      const message = isNetworkError(err)
        ? 'Cannot reach the server. Check your connection and try again.'
        : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not save your payout details. Please try again.');
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payout account</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set up your payout account</Text>
          <Text style={styles.subtitle}>
            Add your MoMo number to receive susu payouts automatically.
          </Text>

          <Text style={styles.sectionLabel}>Network</Text>
          {NETWORKS.map((option) => {
            const selected = network === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.networkCard, selected && styles.networkCardActive]}
                activeOpacity={0.85}
                onPress={() => setNetwork(option.key)}
              >
                <View style={[styles.networkIcon, { backgroundColor: option.color }]}>
                  <MaterialCommunityIcons name={option.icon} size={20} color={Colors.white} />
                </View>
                <Text style={styles.networkLabel}>{option.label}</Text>
                <View style={{ flex: 1 }} />
                <MaterialCommunityIcons
                  name={selected ? 'check-circle' : 'circle-outline'}
                  size={22}
                  color={selected ? Colors.primary : Colors.border}
                />
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>MoMo number</Text>
          <TextInput
            style={[
              styles.input,
              number.length > 0 && (numberValid ? styles.inputValid : styles.inputInvalid),
            ]}
            value={number}
            onChangeText={(t) => setNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="0XXXXXXXXX"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={10}
          />
          {numberValid && network ? (
            <Text style={styles.preview}>
              Payout will go to: {network} ****{number.slice(-4)}
            </Text>
          ) : number.length > 0 && !numberValid ? (
            <Text style={styles.hintError}>Enter a valid 10-digit number starting with 0.</Text>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.noteBox}>
            <MaterialCommunityIcons name="shield-lock-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.noteText}>
              Your MoMo number is only used to receive your susu payout. It is stored securely and never
              shared with other members.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            activeOpacity={canSave ? 0.85 : 1}
            onPress={handleSave}
            disabled={!canSave}
          >
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveLabel}>Confirm and Save</Text>
            )}
          </TouchableOpacity>
        </View>
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
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, lineHeight: 20, marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 10 },
  networkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  networkCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  networkIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  networkLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.textPrimary,
  },
  inputValid: { borderColor: Colors.success },
  inputInvalid: { borderColor: Colors.danger },
  preview: { fontSize: 13, color: Colors.success, fontWeight: '600', marginTop: 10 },
  hintError: { fontSize: 12, color: Colors.danger, marginTop: 8 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: 13 },
  noteBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 24,
  },
  noteText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: Colors.textMuted },
  saveLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
