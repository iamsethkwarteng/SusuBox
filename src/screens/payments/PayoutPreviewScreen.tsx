import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNetworkError } from '@/src/api/client';
import { initiateGroupPayout } from '@/src/api/payments';
import AvatarInitials from '@/src/components/AvatarInitials';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import { useGroupDetail } from '@/src/hooks/useGroups';
import MemberProfileSheet from '@/src/screens/groups/MemberProfileSheet';
import type { GroupMember } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';

type Phase = 'review' | 'sending' | 'success' | 'error';

export default function PayoutPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { group, refresh } = useGroupDetail(id);
  const { user } = useAuth();
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>('review');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!group) return null;

  const recipient = group.payoutRecipient;
  const net = group.payoutNetAmount ?? Math.max(0, group.expected);
  const pot = group.payoutPotValue ?? group.expected;
  // The backend splits deductions into arrears and penalties at close time. Fall
  // back to one lumped row for older cycles that only stored the net amount.
  const arrears = group.payoutArrears;
  const penalties = group.payoutPenalties;
  const hasSplit = arrears != null || penalties != null;
  const deductions = Math.max(0, pot - net);
  const recipientName = recipient?.name ?? group.currentRecipientName ?? 'the recipient';
  // The membership row behind the payout recipient, so their avatar can open
  // the same profile sheet used everywhere else.
  const recipientMember = group.members.find((m) => m.userId === recipient?.userId);
  const hasMomo = recipient?.hasMomo ?? false;
  const blocked = group.payoutCycleBlocked ?? group.payoutFrozen;
  const canSend = confirmed && hasMomo && !blocked && !!group.payoutCycleId;

  const doSend = async () => {
    setModalVisible(false);
    if (!group.payoutCycleId) return;
    setPhase('sending');
    try {
      await initiateGroupPayout(group.payoutCycleId, group.id);
      setPhase('success');
      refresh();
    } catch (err) {
      const message = isNetworkError(err)
        ? 'Connection failed. Payment was not sent. Please try again.'
        : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'The transfer could not be completed. Please try again.');
      setErrorMessage(message);
      setPhase('error');
    }
  };

  // --- Success / error full-screen states ----------------------------------
  if (phase === 'success') {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.resultView}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.successLight }]}>
            <MaterialCommunityIcons name="check-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.resultTitle}>{formatCurrency(net)} sent to {recipientName}!</Text>
          <Text style={styles.resultBody}>
            They will receive it on their {recipient?.momoNetwork ?? 'MoMo'} shortly. A confirmation has
            been sent to their email and phone.
          </Text>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={() => router.back()}>
            <Text style={styles.primaryLabel}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.resultView}>
          <View style={[styles.resultIcon, { backgroundColor: Colors.dangerLight }]}>
            <MaterialCommunityIcons name="close-circle" size={64} color={Colors.danger} />
          </View>
          <Text style={styles.resultTitle}>Payout not sent</Text>
          <Text style={styles.resultBody}>{errorMessage}</Text>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={() => setPhase('review')}>
            <Text style={styles.primaryLabel}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.linkLabel}>Back to group</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Review -------------------------------------------------------------
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} disabled={phase === 'sending'}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send payout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Section 1 — breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payout breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Full pot value</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(pot)}</Text>
          </View>
          {hasSplit ? (
            <>
              {arrears != null && arrears > 0 ? (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: Colors.danger }]}>Arrears deduction</Text>
                  <Text style={[styles.breakdownValue, { color: Colors.danger }]}>
                    − {formatCurrency(arrears)}
                  </Text>
                </View>
              ) : null}
              {penalties != null && penalties > 0 ? (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: Colors.warning }]}>Penalty deduction</Text>
                  <Text style={[styles.breakdownValue, { color: Colors.warning }]}>
                    − {formatCurrency(penalties)}
                  </Text>
                </View>
              ) : null}
            </>
          ) : deductions > 0 ? (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: Colors.danger }]}>Deductions (arrears + penalties)</Text>
              <Text style={[styles.breakdownValue, { color: Colors.danger }]}>− {formatCurrency(deductions)}</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.breakdownRow}>
            <Text style={styles.netLabel}>Net payout</Text>
            <Text style={styles.netValue}>{formatCurrency(net)}</Text>
          </View>
        </View>

        {/* Section 2 — sending to */}
        <Text style={styles.sectionLabel}>Sending to</Text>
        <View style={styles.recipientCard}>
          {/* Recipient avatar → their profile sheet (own → Profile tab). */}
          <AvatarInitials
            name={recipientName}
            photoUrl={recipientMember?.avatarUrl}
            size={44}
            onPress={
              recipientMember
                ? () => {
                    if (recipientMember.userId === user?.id) router.push('/(tabs)/profile');
                    else setSelectedMember(recipientMember);
                  }
                : undefined
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.recipientName}>{recipientName}</Text>
            {hasMomo ? (
              <Text style={styles.recipientMomo}>
                {recipient?.momoNetwork} ****{recipient?.momoLast4}
              </Text>
            ) : (
              <Text style={[styles.recipientMomo, { color: Colors.warning }]}>No MoMo number added</Text>
            )}
          </View>
        </View>

        {/* Where the money is coming from — the group's own held balance. */}
        <View style={styles.sourceBox}>
          <MaterialCommunityIcons name="shield-lock-outline" size={18} color={Colors.primary} />
          <Text style={styles.sourceText}>
            This money is held securely in the {group.name} account. It will be sent directly to{' '}
            {recipientName}&apos;s MoMo — it never passes through your own wallet.
          </Text>
        </View>

        {!hasMomo ? (
          <View style={styles.warnBox}>
            <MaterialCommunityIcons name="alert" size={18} color={Colors.warning} />
            <Text style={styles.warnText}>
              {recipientName} has not added their MoMo number. They need to add it in their SusuBox
              settings before the payout can be sent.
            </Text>
          </View>
        ) : null}

        {blocked ? (
          <View style={styles.warnBox}>
            <MaterialCommunityIcons name="lock-alert-outline" size={18} color={Colors.danger} />
            <Text style={[styles.warnText, { color: Colors.danger }]}>
              This payout is blocked because the recipient has unpaid contributions.
            </Text>
          </View>
        ) : null}

        {/* Section 3 — admin confirmation */}
        <TouchableOpacity
          style={styles.confirmRow}
          activeOpacity={0.8}
          onPress={() => setConfirmed((v) => !v)}
        >
          <MaterialCommunityIcons
            name={confirmed ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={confirmed ? Colors.primary : Colors.textMuted}
          />
          <Text style={styles.confirmText}>I confirm the payout breakdown is correct</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          activeOpacity={canSend ? 0.85 : 1}
          onPress={() => canSend && setModalVisible(true)}
          disabled={!canSend || phase === 'sending'}
        >
          {phase === 'sending' ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.sendLabel}>
              Send {formatCurrency(net)} to {recipientName}&apos;s MoMo
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Confirmation modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send {formatCurrency(net)} to {recipientName}?</Text>
            <Text style={styles.modalBody}>
              This will be sent to their {recipient?.momoNetwork ?? 'MoMo'} number. This action cannot be
              undone.
            </Text>
            <TouchableOpacity style={styles.modalConfirm} activeOpacity={0.85} onPress={doSend}>
              <Text style={styles.modalConfirmLabel}>Yes, send now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} activeOpacity={0.7} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Recipient profile, opened from their avatar. */}
      <MemberProfileSheet
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        isAdmin={false}
        groupId={group.id}
      />
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
  container: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  breakdownLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 8 },
  netLabel: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  netValue: { fontSize: 22, fontWeight: '800', color: Colors.success },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginTop: 24, marginBottom: 10 },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  recipientName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  recipientMomo: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  warnBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  warnText: { flex: 1, fontSize: 12.5, color: Colors.warning, lineHeight: 18 },
  sourceBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  sourceText: { flex: 1, fontSize: 12.5, color: Colors.primaryDark, lineHeight: 18 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
  confirmText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: Colors.divider },
  sendButton: {
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: Colors.textMuted },
  sendLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  resultView: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  resultIcon: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginTop: 8 },
  resultBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  linkLabel: { color: Colors.primary, fontSize: 14, fontWeight: '600', marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(44,44,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: { width: '100%', backgroundColor: Colors.surface, borderRadius: 18, padding: 24, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  modalBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  modalConfirm: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalConfirmLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  modalCancel: { paddingVertical: 12, alignItems: 'center' },
  modalCancelLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
