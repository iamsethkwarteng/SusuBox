import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePaystack } from 'react-native-paystack-webview';

import AvatarInitials from '@/src/components/AvatarInitials';
import ErrorState from '@/src/components/ErrorState';
import { showToast } from '@/src/components/Toast';
import { initializePayment, verifyPayment } from '@/src/api/contributions';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import { useGroupDetail } from '@/src/hooks/useGroups';
import { calculatePaystackFee } from '@/src/utils/calculatePaystackFee';
import { formatCurrency } from '@/src/utils/formatCurrency';

// Shared header so the loading, error and empty states keep the back button —
// otherwise a failed load would strand the user in a modal with no way out.
function PaymentHeader({ user }: { user: ReturnType<typeof useAuth>['user'] }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Pay contribution</Text>
      <AvatarInitials
        name={user?.name ?? 'You'}
        photoUrl={user?.profilePhotoUrl}
        size={32}
        onPress={() => router.push('/(tabs)/profile')}
      />
    </View>
  );
}

export default function PaymentScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  // Detail carries the open cycle's id, which the contribution must target.
  const { group, isLoading, error, refresh } = useGroupDetail(groupId);
  const { popup } = usePaystack();
  const [processing, setProcessing] = useState(false);

  // This screen used to `return null` whenever `group` was undefined, which is
  // true for the entire fetch — and forever if the fetch failed. Tapping "Pay
  // contribution" navigated here correctly and then showed a blank modal, so
  // the button looked dead. A cold start on Render's free tier takes 30-60s,
  // which turned a brief flicker into a minute of nothing.
  if (isLoading && !group) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <PaymentHeader user={user} />
        <View style={styles.stateWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.stateText}>Loading payment details…</Text>
          <Text style={styles.stateHint}>
            The server may be waking up — this can take up to a minute.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <PaymentHeader user={user} />
        <ErrorState
          message={error ?? 'Could not load this group. Please try again.'}
          onRetry={refresh}
        />
      </SafeAreaView>
    );
  }

  // Loaded, but the admin closed the cycle between the group screen and here.
  if (!group.currentCycleId) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <PaymentHeader user={user} />
        <View style={styles.stateWrap}>
          <MaterialCommunityIcons name="clock-outline" size={44} color={Colors.textMuted} />
          <Text style={styles.stateText}>No open cycle</Text>
          <Text style={styles.stateHint}>
            There is nothing to contribute to right now. Your admin needs to open the next cycle.
          </Text>
          <TouchableOpacity style={styles.stateButton} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.stateButtonLabel}>Back to group</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Member pays the processing fee on top; the group receives the full amount.
  const fee = calculatePaystackFee(group.contributionAmount);

  const handlePay = async () => {
    if (!group.currentCycleId) {
      Alert.alert(
        'No open cycle',
        'There is no open cycle to contribute to yet. Ask your group admin to open one.',
      );
      return;
    }
    setProcessing(true);
    try {
      // 1. Backend creates the pending transaction (with the fee breakdown) and
      // returns the reference + the total to charge + the group's subaccount.
      const { reference, amount, subaccountCode } = await initializePayment({
        cycleId: group.currentCycleId,
      });

      if (__DEV__) {
        // `amount` is GHS. The library multiplies by 100 itself
        // (utils.js: `amount: ${config.amount * 100}`), so pre-converting to
        // pesewas here would charge 100x. These two lines make that visible.
        console.log('[Payment] fee breakdown:', fee);
        console.log(
          `[Payment] passing amount=${amount} GHS -> library sends ${Math.round(amount * 100)} pesewas`,
        );
      }

      // 2. Paystack SDK does the actual init + charge using that reference. The
      // member is charged the TOTAL (contribution + fee); the split routes the
      // contribution into the group's subaccount when one is configured.
      popup.checkout({
        email: user?.email ?? '',
        amount, // total = contribution + fee
        reference,
        // The split routes the contribution into the group's subaccount. This
        // library forwards `subaccount` (fee-bearer is configured on the
        // subaccount itself, so no `bearer` param is needed or supported).
        ...(subaccountCode ? { subaccount: subaccountCode } : {}),
        metadata: { groupId: group.id, cycleId: group.currentCycleId, userId: user?.id },
        // Fires when Paystack's sheet has actually rendered. The library owns
        // the modal and shows its own spinner, so there is no overlay for us to
        // add — this just confirms in the log that checkout opened rather than
        // failing silently.
        onLoad: (res) => {
          if (__DEV__) console.log('[Payment] Paystack sheet opened:', res.accessCode);
        },
        onSuccess: async () => {
          // 3. Record it now via verify (idempotent with the webhook), so the
          // contribution lands even when the webhook can't reach a dev server.
          try {
            await verifyPayment(reference);
          } catch {
            showToast('Payment received — confirming shortly');
          }
          setProcessing(false);
          Alert.alert(
            'Payment successful',
            // Record/confirm the CONTRIBUTION amount, not the total charged.
            `${formatCurrency(group.contributionAmount)} contributed to ${group.name} ✓`,
            [{ text: 'Done', onPress: () => router.back() }],
          );
        },
        onCancel: () => setProcessing(false),
        onError: () => {
          setProcessing(false);
          Alert.alert('Payment failed', 'Something went wrong processing your payment. Please try again.');
        },
      });
    } catch (err) {
      setProcessing(false);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not start the payment. Please try again.';
      Alert.alert('Payment unavailable', message);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <PaymentHeader user={user} />

      <View style={styles.container}>
        <Text style={styles.amountLabel}>Total Contribution</Text>
        <Text style={styles.amountValue}>{formatCurrency(group.contributionAmount)}</Text>
        <Text style={styles.amountMeta}>{group.name} · Cycle {group.cycle}</Text>

        <View style={styles.secureNote}>
          <MaterialCommunityIcons name="lock-outline" size={18} color={Colors.primary} />
          <Text style={styles.secureText}>
            Payment confirmed automatically. Your contribution goes straight into {group.name}&apos;s own
            secure Paystack account and is held there until the payout is confirmed.
          </Text>
        </View>

        {/* Fee breakdown — the member pays the processing fee on top. */}
        <View style={styles.detailCard}>
          <Text style={styles.breakdownTitle}>Payment breakdown</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Contribution amount</Text>
            <Text style={styles.detailValue}>{fee.contribution_display}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Processing fee</Text>
            <Text style={styles.detailValue}>{fee.fee_display}</Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>Total to pay</Text>
            <Text style={styles.totalValue}>{fee.total_display}</Text>
          </View>
          <View style={styles.feeNote}>
            <MaterialCommunityIcons name="information-outline" size={15} color={Colors.primary} />
            <Text style={styles.feeNoteText}>
              Your group receives {fee.contribution_display} in full. The fee covers secure mobile money
              processing.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.payButton} activeOpacity={0.85} onPress={handlePay} disabled={processing}>
          {processing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.payLabel}>Pay {fee.total_display} via MoMo</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.directNote}>
          Your payment goes directly into the group&apos;s secure account. SusuBox does not hold your money.
        </Text>
        <View style={styles.securedByRow}>
          <MaterialCommunityIcons name="lock-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.securedByText}>SECURED BY PAYSTACK</Text>
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
  // Loading / error / no-open-cycle states. Previously this screen rendered
  // null in all three cases, which read as a dead button.
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  stateText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  stateHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
  },
  stateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  stateButtonLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  container: { flex: 1, alignItems: 'center', padding: 24, paddingTop: 40 },
  amountLabel: { fontSize: 13, color: Colors.textSecondary },
  amountValue: { fontSize: 40, fontWeight: '800', color: Colors.textPrimary, marginTop: 6 },
  amountMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  secureNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    marginTop: 32,
  },
  secureText: { flex: 1, fontSize: 12, color: Colors.primaryDark, lineHeight: 18 },
  detailCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginTop: 20,
    gap: 14,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: Colors.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  breakdownTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  breakdownDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 2 },
  totalLabel: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  totalValue: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  feeNote: { flexDirection: 'row', gap: 8, marginTop: 6 },
  feeNoteText: { flex: 1, fontSize: 11.5, color: Colors.textSecondary, lineHeight: 16 },
  directNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  footer: { padding: 24, alignItems: 'center', gap: 10 },
  payButton: {
    width: '100%',
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  payLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  securedByRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  securedByText: { fontSize: 11, color: Colors.textMuted, letterSpacing: 0.5, fontWeight: '700' },
});
