import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNetworkError } from '@/src/api/client';
import { createGoal } from '@/src/api/personalSusu';
import { Colors } from '@/src/constants/colors';
import type { PersonalGoalFrequency, PersonalGoalType } from '@/src/types';

const EMOJI_OPTIONS = ['🎯', '🎓', '🚗', '🏠', '✈️', '💍', '🎄', '👶', '💼', '📱', '🏥', '🛍️'];

const GOAL_TYPES: { value: PersonalGoalType; label: string; hint: string }[] = [
  { value: 'amount', label: 'I reach my target amount', hint: 'Unlocks the moment you hit the amount' },
  { value: 'date', label: 'My target date arrives', hint: 'Unlocks on the date, whatever you saved' },
  { value: 'both', label: 'Both are met', hint: 'Strictest — needs the amount AND the date' },
];

const FREQUENCIES: PersonalGoalFrequency[] = ['daily', 'weekly', 'monthly', 'flexible'];

// YYYY-MM-DD, and a real calendar date (rejects 2026-02-31).
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && value === d.toISOString().slice(0, 10);
}

export default function CreateGoalScreen() {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [goalType, setGoalType] = useState<PersonalGoalType>('amount');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [frequency, setFrequency] = useState<PersonalGoalFrequency>('flexible');
  const [allowEarlyWithdrawal, setAllowEarlyWithdrawal] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAmount = goalType === 'amount' || goalType === 'both';
  const needsDate = goalType === 'date' || goalType === 'both';

  const handleCreate = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Please give your goal a name.');
      return;
    }
    if (needsAmount && !(Number(targetAmount) > 0)) {
      setError('Enter a target amount greater than 0.');
      return;
    }
    if (needsDate) {
      if (!isValidDate(targetDate)) {
        setError('Enter the target date as YYYY-MM-DD, e.g. 2026-12-25.');
        return;
      }
      if (new Date(`${targetDate}T00:00:00`) <= new Date()) {
        setError('Your target date must be in the future.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const { warning } = await createGoal({
        name: name.trim(),
        emoji,
        goalType,
        targetAmount: needsAmount ? Number(targetAmount) : undefined,
        targetDate: needsDate ? targetDate : undefined,
        contributionAmount: contributionAmount ? Number(contributionAmount) : undefined,
        frequency,
        allowEarlyWithdrawal,
      });
      // A warning means the goal exists but has no Paystack account yet —
      // surface it rather than letting the user discover it at payment time.
      if (warning) Alert.alert('Goal created', warning);
      router.back();
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(
        isNetworkError(err)
          ? 'Cannot reach the server. Please try again.'
          : (data?.message ?? 'Could not create your goal. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Savings Goal</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>GOAL DETAILS</Text>

          <Text style={styles.label}>Pick an icon</Text>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.emojiOption, emoji === e && styles.emojiSelected]}
                onPress={() => setEmoji(e)}
                activeOpacity={0.7}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Goal name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. School Fees 2026"
            placeholderTextColor={Colors.textMuted}
            maxLength={100}
          />

          <Text style={styles.label}>Unlock my savings when…</Text>
          {GOAL_TYPES.map((option) => {
            const selected = goalType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.typeOption, selected && styles.typeSelected]}
                onPress={() => setGoalType(option.value)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color={selected ? Colors.primary : Colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeLabel, selected && { color: Colors.primary }]}>
                    {option.label}
                  </Text>
                  <Text style={styles.typeHint}>{option.hint}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {needsAmount ? (
            <>
              <Text style={styles.label}>Target amount (GHS)</Text>
              <TextInput
                style={styles.input}
                value={targetAmount}
                onChangeText={(t) => setTargetAmount(t.replace(/[^0-9.]/g, ''))}
                placeholder="e.g. 5000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
            </>
          ) : null}

          {needsDate ? (
            <>
              <Text style={styles.label}>Target date</Text>
              <TextInput
                style={styles.input}
                value={targetDate}
                onChangeText={(t) => setTargetDate(t.replace(/[^0-9-]/g, '').slice(0, 10))}
                placeholder="YYYY-MM-DD, e.g. 2026-12-25"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </>
          ) : null}

          <Text style={styles.label}>Planned contribution (optional)</Text>
          <TextInput
            style={styles.input}
            value={contributionAmount}
            onChangeText={(t) => setContributionAmount(t.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 500 — you can still pay any amount"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>How often?</Text>
          <View style={styles.freqRow}>
            {FREQUENCIES.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.freqChip, frequency === f && styles.freqChipSelected]}
                onPress={() => setFrequency(f)}
                activeOpacity={0.8}
              >
                <Text style={[styles.freqText, frequency === f && styles.freqTextSelected]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 26 }]}>LOCK SETTINGS</Text>
          <View style={styles.lockOption}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockTitle}>Allow early withdrawal</Text>
              <Text style={styles.lockDesc}>
                Take your money out before the goal, minus a 10% penalty. Turn this off to lock it
                completely.
              </Text>
            </View>
            <Switch
              value={allowEarlyWithdrawal}
              onValueChange={setAllowEarlyWithdrawal}
              trackColor={{ false: Colors.border, true: Colors.success }}
              thumbColor={Colors.white}
            />
          </View>

          {!allowEarlyWithdrawal ? (
            <View style={styles.warningBox}>
              <MaterialCommunityIcons name="lock-alert" size={19} color={Colors.warning} />
              <Text style={styles.warningText}>
                With early withdrawal off, this money is locked until the goal is met — there is no way
                to take it out early, for any reason. Choose this only if you are sure.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.createButton, submitting && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.createLabel}>Create savings goal</Text>
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
  container: { padding: 20, paddingBottom: 48 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiSelected: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: Colors.primaryLight },
  emojiText: { fontSize: 22 },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 14,
    marginBottom: 10,
  },
  typeSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  typeHint: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 2 },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  freqChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  freqChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  freqText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  freqTextSelected: { color: Colors.white },
  lockOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  lockTitle: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  lockDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 17 },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  warningText: { flex: 1, fontSize: 12.5, color: Colors.warning, lineHeight: 18 },
  errorText: { color: Colors.danger, fontSize: 13, marginTop: 18, lineHeight: 19 },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 26,
  },
  createButtonDisabled: { backgroundColor: Colors.textMuted },
  createLabel: { color: Colors.white, fontSize: 15.5, fontWeight: '700' },
});
