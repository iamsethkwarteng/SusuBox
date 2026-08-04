import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { usePaystack } from 'react-native-paystack-webview';

import { isNetworkError } from '@/src/api/client';
import {
  collectGoal,
  confirmEarlyWithdrawal,
  fetchGoal,
  initializeGoalContribution,
  previewEarlyWithdrawal,
  verifyGoalContribution,
} from '@/src/api/personalSusu';
import ErrorState from '@/src/components/ErrorState';
import { SkeletonLoader } from '@/src/components/SkeletonLoader';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import type { PersonalGoal } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { popup } = usePaystack();

  const [goal, setGoal] = useState<PersonalGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await fetchGoal(id);
      setGoal(data);
      // Pre-fill with the planned contribution, only while the box is empty so
      // a reload never overwrites what the user is typing.
      setAmount((prev) => prev || (data.contributionAmount ? String(data.contributionAmount) : ''));
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Cannot reach the server. Check your connection and try again.'
          : 'Could not load this goal.',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleContribute = async () => {
    const value = Number(amount);
    if (!value || value < 1) {
      Alert.alert('Enter an amount', 'The minimum contribution is GHS 1.00.');
      return;
    }
    if (!goal) return;

    setPaying(true);
    try {
      // Server records the pending contribution and returns the reference; the
      // SDK does the charge, exactly as group contributions work.
      const init = await initializeGoalContribution(goal.id, value);
      popup.checkout({
        email: user?.email ?? '',
        amount: init.amount, // contribution + Paystack fee
        reference: init.reference,
        ...(init.subaccountCode ? { subaccount: init.subaccountCode } : {}),
        metadata: { type: 'personal_susu', goalId: goal.id, userId: user?.id },
        onSuccess: async () => {
          // Record now via verify (idempotent with the webhook), so the goal
          // total updates even when the webhook can't reach a dev server.
          try {
            await verifyGoalContribution(init.reference);
          } catch {
            showToast('Payment received — confirming shortly');
          }
          setPaying(false);
          setAmount('');
          await load();
          Alert.alert(
            'Saved',
            `${formatCurrency(value)} added to ${goal.name}. Your money stays locked until the goal is met.`,
          );
        },
        onCancel: () => setPaying(false),
        onError: () => {
          setPaying(false);
          Alert.alert('Payment failed', 'Something went wrong. Please try again.');
        },
      });
    } catch (err) {
      setPaying(false);
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      Alert.alert('Cannot contribute', data?.message ?? 'Could not start the payment.');
    }
  };

  const handleCollect = () => {
    if (!goal) return;
    Alert.alert(
      'Collect your savings',
      `Send ${formatCurrency(goal.currentAmount)} to your ${user?.momoNetwork ?? 'MoMo'} wallet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, collect',
          onPress: async () => {
            setWorking(true);
            try {
              const message = await collectGoal(goal.id);
              Alert.alert('Goal complete 🎉', message, [
                { text: 'Done', onPress: () => router.back() },
              ]);
            } catch (err) {
              const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
              Alert.alert('Could not collect', data?.message ?? 'Please try again.');
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  };

  // Two-phase: the backend previews the penalty without moving anything, and
  // only a second explicit confirmation actually withdraws.
  const handleEarlyWithdrawal = async () => {
    if (!goal) return;
    setWorking(true);
    try {
      const preview = await previewEarlyWithdrawal(goal.id);
      Alert.alert(
        'Early withdrawal penalty',
        `Total saved: ${formatCurrency(preview.totalSaved)}\n` +
          `Penalty (${preview.penaltyPercent}%): −${formatCurrency(preview.penaltyAmount)}\n` +
          `You receive: ${formatCurrency(preview.amountToReceive)}\n\n` +
          `Your goal "${goal.name}" will be closed. This cannot be undone.`,
        [
          { text: 'Keep saving', style: 'cancel' },
          {
            text: 'Withdraw anyway',
            style: 'destructive',
            onPress: async () => {
              setWorking(true);
              try {
                const message = await confirmEarlyWithdrawal(goal.id);
                Alert.alert('Withdrawn', message, [
                  { text: 'Done', onPress: () => router.back() },
                ]);
              } catch (err) {
                const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
                Alert.alert('Could not withdraw', data?.message ?? 'Please try again.');
              } finally {
                setWorking(false);
              }
            },
          },
        ],
      );
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      Alert.alert('Could not withdraw', data?.message ?? 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.skeletonWrap}>
          <SkeletonLoader height={220} borderRadius={18} />
          <SkeletonLoader height={140} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !goal) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ErrorState message={error ?? 'Goal not found.'} onRetry={load} />
      </SafeAreaView>
    );
  }

  const isActive = goal.status === 'active';
  const progress = goal.progressPercent ?? 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {goal.name}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.heroCard}>
            <Text style={styles.emoji}>{goal.emoji}</Text>
            <Text style={styles.goalName}>{goal.name}</Text>
            <Text style={styles.amountLarge}>{formatCurrency(goal.currentAmount)}</Text>
            {goal.targetAmount ? (
              <Text style={styles.targetText}>of {formatCurrency(goal.targetAmount)} target</Text>
            ) : null}

            {goal.targetAmount ? (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: progress >= 100 ? Colors.success : Colors.primary,
                    },
                  ]}
                />
              </View>
            ) : null}

            {isActive ? (
              <View style={[styles.lockBadge, goal.isUnlocked ? styles.unlockedBadge : styles.lockedBadge]}>
                <MaterialCommunityIcons
                  name={goal.isUnlocked ? 'lock-open-variant' : 'lock'}
                  size={15}
                  color={goal.isUnlocked ? Colors.success : Colors.textSecondary}
                />
                <Text style={[styles.lockBadgeText, goal.isUnlocked && { color: Colors.success }]}>
                  {goal.isUnlocked ? 'Goal reached — ready to collect' : 'Locked'}
                </Text>
              </View>
            ) : (
              <View style={[styles.lockBadge, styles.lockedBadge]}>
                <Text style={styles.lockBadgeText}>
                  {goal.status === 'completed'
                    ? 'Collected'
                    : goal.status === 'withdrawn_early'
                      ? `Withdrawn early${goal.withdrawalPenaltyAmount ? ` — ${formatCurrency(goal.withdrawalPenaltyAmount)} penalty` : ''}`
                      : 'Closed'}
                </Text>
              </View>
            )}

            {isActive && !goal.isUnlocked && goal.lockedReasons.length > 0 ? (
              <View style={styles.conditionsBox}>
                {goal.lockedReasons.map((reason) => (
                  <Text key={reason} style={styles.conditionText}>
                    • {reason}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>

          {isActive ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add to your savings</Text>
              <View style={styles.amountRow}>
                <Text style={styles.ghsLabel}>GHS</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, paying && styles.buttonDisabled]}
                onPress={handleContribute}
                disabled={paying}
                activeOpacity={0.85}
              >
                {paying ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryLabel}>Add to {goal.name}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.feeNote}>
                A small Paystack processing fee is added on top, so your goal receives the full amount.
              </Text>
            </View>
          ) : null}

          {isActive && goal.isUnlocked ? (
            <TouchableOpacity
              style={[styles.collectButton, working && styles.buttonDisabled]}
              onPress={handleCollect}
              disabled={working}
              activeOpacity={0.85}
            >
              {working ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.collectLabel}>
                  🎉 Collect {formatCurrency(goal.currentAmount)}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          {isActive && !goal.isUnlocked && goal.allowEarlyWithdrawal && goal.currentAmount > 0 ? (
            <TouchableOpacity
              style={styles.earlyButton}
              onPress={handleEarlyWithdrawal}
              disabled={working}
              activeOpacity={0.8}
            >
              <Text style={styles.earlyLabel}>
                Withdraw early ({goal.penaltyPercent}% penalty)
              </Text>
            </TouchableOpacity>
          ) : null}

          {isActive && !goal.allowEarlyWithdrawal && !goal.isUnlocked ? (
            <View style={styles.hardLockBox}>
              <MaterialCommunityIcons name="lock-check" size={18} color={Colors.primary} />
              <Text style={styles.hardLockText}>
                You locked this goal completely — it can&apos;t be withdrawn until the target is met.
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contribution history</Text>
            {goal.contributions.filter((c) => !c.pending).length === 0 ? (
              <Text style={styles.noHistory}>No contributions yet. Start saving!</Text>
            ) : (
              goal.contributions
                .filter((c) => !c.pending)
                .map((c) => (
                  <View key={c.id} style={styles.historyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyAmount}>{formatCurrency(c.amount)}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(c.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View style={styles.methodChip}>
                      <Text style={styles.methodText}>{(c.paymentMethod ?? 'momo').toUpperCase()}</Text>
                    </View>
                  </View>
                ))
            )}
          </View>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: Colors.primary },
  skeletonWrap: { padding: 20, gap: 16 },
  container: { padding: 20, paddingBottom: 44, gap: 16 },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
    alignItems: 'center',
    gap: 6,
  },
  emoji: { fontSize: 40 },
  goalName: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  amountLarge: { fontSize: 34, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  targetText: { fontSize: 13, color: Colors.textSecondary },
  progressTrack: {
    width: '100%',
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: { height: 9, borderRadius: 5 },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 14,
  },
  lockedBadge: { backgroundColor: Colors.background },
  unlockedBadge: { backgroundColor: Colors.successLight },
  lockBadgeText: { fontSize: 12.5, fontWeight: '700', color: Colors.textSecondary },
  conditionsBox: { marginTop: 10, gap: 3, alignItems: 'center' },
  conditionText: { fontSize: 12.5, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  ghsLabel: { fontSize: 15, fontWeight: '800', color: Colors.textSecondary },
  amountInput: { flex: 1, paddingVertical: 13, fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  feeNote: { fontSize: 11.5, color: Colors.textMuted, marginTop: 10, lineHeight: 16 },
  collectButton: {
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  collectLabel: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  earlyButton: { paddingVertical: 14, alignItems: 'center' },
  earlyLabel: { color: Colors.danger, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  hardLockBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
  },
  hardLockText: { flex: 1, fontSize: 12.5, color: Colors.primaryDark, lineHeight: 18 },
  noHistory: { fontSize: 13, color: Colors.textMuted },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  historyAmount: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  historyDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  methodChip: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  methodText: { fontSize: 10.5, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.4 },
});
