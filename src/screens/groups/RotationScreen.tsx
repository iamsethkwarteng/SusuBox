import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import AvatarInitials from '@/src/components/AvatarInitials';
import PayoutDeductionCard from '@/src/components/PayoutDeductionCard';
import PayoutStatusBanner, { type PayoutBannerStatus } from '@/src/components/PayoutStatusBanner';
import ReliabilityBar from '@/src/components/ReliabilityBar';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { isNetworkError } from '@/src/api/client';
import { closeCycle } from '@/src/api/cycles';
import { updateRotationOrder } from '@/src/api/groups';
import { useAuth } from '@/src/hooks/useAuth';
import { useGroupDetail } from '@/src/hooks/useGroups';
import MemberProfileSheet from '@/src/screens/groups/MemberProfileSheet';
import type { GroupMember, RotationEntry } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { formatDate } from '@/src/utils/formatDate';

const STATE_LABEL: Record<RotationEntry['state'], string> = {
  completed: 'Completed',
  current: 'Current Cycle',
  upcoming: 'Upcoming',
};

export default function RotationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { group, refresh } = useGroupDetail(id);
  const { user } = useAuth();
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  // Mechanism 3 — admin must confirm the deduction breakdown explicitly.
  const [breakdownConfirmed, setBreakdownConfirmed] = useState(false);
  const [closing, setClosing] = useState(false);
  // Mechanism 1 — local draggable order while cycle 1 hasn't opened.
  const [draftOrder, setDraftOrder] = useState<RotationEntry[]>([]);

  useEffect(() => {
    if (group) setDraftOrder(group.rotation);
  }, [group]);

  const { arrears, penalty, lateMember } = useMemo(() => {
    if (!group) return { arrears: 0, penalty: 0, lateMember: undefined };
    const lateMembers = group.members.filter((m) => m.status === 'late' && !m.removed);
    const totalArrears = lateMembers.reduce(
      (sum, m) => sum + group.contributionAmount * (1 - m.progressPct / 100),
      0,
    );
    const totalPenalty = lateMembers.reduce((sum, m) => sum + m.penaltyDebt, 0);
    return { arrears: Math.round(totalArrears), penalty: totalPenalty, lateMember: lateMembers[0] };
  }, [group]);

  if (!group) return null;

  const isAdmin = group.role === 'organizer';

  // Same single rule as everywhere else: my own avatar → Profile, anyone
  // else's → their profile sheet.
  const openMemberProfile = (member: GroupMember | undefined) => {
    if (!member) return;
    if (member.userId === user?.id) {
      router.push('/(tabs)/profile');
      return;
    }
    setSelectedMember(member);
  };
  const memberById = (memberId: string) => group.members.find((m) => m.id === memberId);
  const recipientMember = group.members.find((m) => m.userId === group.currentRecipientId);

  const net = Math.max(0, group.expected - arrears - penalty);
  const closeDisabled = group.payoutFrozen || !breakdownConfirmed || closing;

  // Payout banner state, derived from the latest closed/paid-out cycle.
  const payoutStatus: PayoutBannerStatus =
    group.payoutCycleStatus === 'paid_out'
      ? 'paid_out'
      : group.payoutCycleStatus === 'closed'
        ? group.payoutCycleBlocked
          ? 'blocked'
          : group.payoutRecipient && !group.payoutRecipient.hasMomo
            ? 'no_momo'
            : 'closed'
        : 'open';
  const payoutRecipientName = group.payoutRecipient?.name ?? group.currentRecipientName;
  const payoutNet = group.payoutNetAmount ?? net;

  const handleClosePress = async () => {
    // Mechanism 2 — tapping the disabled button explains exactly why.
    if (group.payoutFrozen) {
      showToast(`Clear ${lateMember?.name ?? 'the member'}'s arrears before releasing payout`);
      return;
    }
    if (!breakdownConfirmed) {
      showToast('Tick "I confirm this breakdown is correct" first');
      return;
    }
    if (!group.currentCycleId) {
      showToast('No open cycle to close');
      return;
    }
    setClosing(true);
    try {
      // Close applies penalties + recomputes reliability and calculates the net
      // payout. The money is sent in the reviewed PayoutPreview step (real
      // Paystack transfer to the recipient's MoMo), not here.
      await closeCycle(group.id, group.currentCycleId);
      setBreakdownConfirmed(false);
      refresh();
      showToast('Cycle closed — review and send the payout');
      router.push(`/group/${group.id}/payout`);
    } catch (error) {
      if (isNetworkError(error)) {
        showToast('You appear to be offline');
      } else {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not close the cycle.';
        showToast(message);
      }
    } finally {
      setClosing(false);
    }
  };

  const handleDragEnd = async (data: RotationEntry[]) => {
    // Re-number positions to match the new visual order.
    const renumbered = data.map((entry, index) => ({ ...entry, position: index + 1 }));
    setDraftOrder(renumbered);
    try {
      await updateRotationOrder(
        group.id,
        renumbered.map((e) => ({ userId: e.userId, position: e.position })),
      );
      showToast('Rotation order saved');
    } catch (error) {
      // Never report a save that didn't reach the server — revert and say so.
      setDraftOrder(group.rotation);
      showToast(
        isNetworkError(error)
          ? 'Could not save order — check your connection'
          : 'Could not save order — reverted',
      );
    }
  };

  const header = (
    <View>
      <View style={styles.potCard}>
        <View style={styles.potHeader}>
          <Text style={styles.potLabel}>CURRENT POT</Text>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{group.cycleStarted ? 'Active' : 'Not started'}</Text>
          </View>
        </View>
        <Text style={styles.potValue}>{formatCurrency(group.expected)}</Text>
        <Text style={styles.potMeta}>
          {group.totalCycles} cycles total · {group.history.filter((h) => h.completed).length} completed
        </Text>
      </View>

      {/* Payout status for the latest closed/paid-out cycle. Admins get a
          "Send Payout" button that opens the reviewed MoMo transfer screen. */}
      <PayoutStatusBanner
        status={payoutStatus}
        recipientName={payoutRecipientName}
        netAmount={payoutNet}
        network={group.payoutRecipient?.momoNetwork}
        isAdmin={isAdmin}
        onSendPayout={() => router.push(`/group/${group.id}/payout`)}
      />

      {/* Mechanism 2 — payout freeze, named member + amount. */}
      {group.payoutFrozen && lateMember ? (
        <View style={styles.freezeBanner}>
          <MaterialCommunityIcons name="lock-alert-outline" size={18} color={Colors.danger} />
          <Text style={styles.freezeText}>
            Payout blocked — {lateMember.name} has {formatCurrency(arrears + penalty)} in unpaid contributions
          </Text>
        </View>
      ) : null}

      {/* Mechanism 1 — rotation lock state banner. */}
      {group.cycleStarted ? (
        <View style={styles.lockBanner}>
          <MaterialCommunityIcons name="lock-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.lockText}>Rotation is locked — cycle 1 has started</Text>
        </View>
      ) : (
        <View style={styles.reorderBanner}>
          <MaterialCommunityIcons name="drag-vertical" size={16} color={Colors.primaryDark} />
          <Text style={styles.reorderText}>
            {isAdmin ? 'Hold and drag members to set the payout order before cycle 1 opens' : 'The admin is finalising the payout order'}
          </Text>
        </View>
      )}

      {group.cycleStarted ? (
        <>
          <Text style={styles.sectionLabel}>YOUR PAYOUT PREVIEW</Text>
          {/* Mechanism 3 — breakdown always shown; admin confirms via checkbox. */}
          <PayoutDeductionCard
            pot={group.expected}
            arrears={arrears}
            penalty={penalty}
            confirmed={breakdownConfirmed}
            onToggleConfirmed={isAdmin ? () => setBreakdownConfirmed((v) => !v) : undefined}
          />
        </>
      ) : null}

      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>ROTATION SCHEDULE</Text>
    </View>
  );

  // --- Pre-cycle: draggable reorder list (Mechanism 1) ---------------------
  if (!group.cycleStarted) {
    const renderDraggable = ({ item, drag, isActive, getIndex }: RenderItemParams<RotationEntry>) => (
      <ScaleDecorator>
        <TouchableOpacity
          style={[styles.dragCard, isActive && styles.dragCardActive]}
          onLongPress={isAdmin ? drag : undefined}
          delayLongPress={150}
          activeOpacity={0.9}
        >
          <Text style={styles.dragPosition}>{(getIndex() ?? 0) + 1}</Text>
          <AvatarInitials
            name={item.memberName}
            photoUrl={memberById(item.memberId)?.avatarUrl}
            size={40}
            onPress={() => openMemberProfile(memberById(item.memberId))}
          />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={styles.dragName}>{item.memberName}</Text>
            <ReliabilityBar score={item.reliabilityScore ?? 50} />
          </View>
          {isAdmin ? (
            <MaterialCommunityIcons name="drag-horizontal-variant" size={22} color={Colors.textMuted} />
          ) : null}
        </TouchableOpacity>
      </ScaleDecorator>
    );

    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Payout rotation</Text>
            <Text style={styles.headerSubtitle}>{group.name}</Text>
          </View>
          <AvatarInitials
            name={group.currentRecipientName}
            photoUrl={recipientMember?.avatarUrl}
            size={32}
            onPress={recipientMember ? () => openMemberProfile(recipientMember) : undefined}
          />
        </View>
        <DraggableFlatList
          data={draftOrder}
          keyExtractor={(item) => item.memberId}
          onDragEnd={({ data }) => handleDragEnd(data)}
          renderItem={renderDraggable}
          ListHeaderComponent={header}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={styles.container}
        />
        <MemberProfileSheet
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          isAdmin={isAdmin}
          groupId={group.id}
        />
      </SafeAreaView>
    );
  }

  // --- Cycle started: locked timeline + payout controls --------------------
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Payout rotation</Text>
          <Text style={styles.headerSubtitle}>{group.name}</Text>
        </View>
        <AvatarInitials
          name={group.currentRecipientName}
          photoUrl={recipientMember?.avatarUrl}
          size={32}
          onPress={recipientMember ? () => openMemberProfile(recipientMember) : undefined}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 150 }]}>
        {header}
        <View style={styles.scheduleList}>
          {group.rotation.map((entry, idx) => (
            <View key={entry.position} style={styles.scheduleRow}>
              <View style={styles.scheduleLeft}>
                <View
                  style={[
                    styles.scheduleDot,
                    entry.state === 'completed' && styles.scheduleDotDone,
                    entry.state === 'current' && styles.scheduleDotCurrent,
                  ]}
                >
                  {entry.state === 'completed' ? (
                    <MaterialCommunityIcons name="check" size={12} color={Colors.white} />
                  ) : entry.state === 'current' ? (
                    <View style={styles.scheduleDotInner} />
                  ) : null}
                </View>
                {idx < group.rotation.length - 1 ? <View style={styles.scheduleLine} /> : null}
              </View>

              <View style={[styles.scheduleCard, entry.state === 'current' && styles.scheduleCardCurrent]}>
                <View style={styles.scheduleCardHeader}>
                  <Text style={styles.scheduleName}>
                    {entry.position}. {entry.memberName}
                  </Text>
                  {entry.state === 'current' ? (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>CURRENT</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.scheduleDate}>
                  {formatDate(entry.date)} — {STATE_LABEL[entry.state]}
                </Text>
                {entry.state === 'current' && entry.totalCount ? (
                  <View style={styles.collectionsRow}>
                    <Text style={styles.collectionsLabel}>
                      Collections: {entry.collectedCount}/{entry.totalCount} paid
                    </Text>
                    <Text style={styles.collectionsPct}>
                      {Math.round(((entry.collectedCount ?? 0) / entry.totalCount) * 100)}%
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.scheduleAmount}>{formatCurrency(entry.amount)}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {isAdmin ? (
        <View style={styles.footer}>
          {/* Disabled (greyed) when frozen or unconfirmed; the press handler
              still fires to show the explanatory tooltip toast. */}
          <TouchableOpacity
            style={[styles.closeButton, closeDisabled && styles.closeButtonDisabled]}
            activeOpacity={closeDisabled ? 1 : 0.85}
            onPress={handleClosePress}
          >
            <MaterialCommunityIcons
              name={group.payoutFrozen ? 'lock-outline' : 'lock-open-variant-outline'}
              size={18}
              color={Colors.white}
            />
            <Text style={styles.closeLabel}>{closing ? 'Processing…' : 'Close cycle & Payout'}</Text>
          </TouchableOpacity>
          <Text style={styles.footerHint}>Only admins can close the cycle once all payments are verified.</Text>
        </View>
      ) : null}

      <MemberProfileSheet
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        isAdmin={isAdmin}
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
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  container: { padding: 20, paddingBottom: 60 },
  potCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 16,
  },
  potHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  potLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  activeBadge: { backgroundColor: Colors.successLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  activeBadgeText: { color: Colors.success, fontSize: 11, fontWeight: '800' },
  potValue: { fontSize: 30, fontWeight: '800', color: Colors.primary, marginTop: 8 },
  potMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  freezeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  freezeText: { flex: 1, color: Colors.danger, fontSize: 13, fontWeight: '600' },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.divider,
    borderRadius: 10,
    paddingVertical: 9,
    marginBottom: 20,
  },
  lockText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  reorderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  reorderText: { flex: 1, color: Colors.primaryDark, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 10 },
  dragCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  dragCardActive: {
    borderColor: Colors.primary,
    elevation: 6,
    shadowColor: Colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dragPosition: {
    width: 24,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
  },
  dragName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  scheduleList: { marginTop: 4 },
  scheduleRow: { flexDirection: 'row', gap: 12 },
  scheduleLeft: { alignItems: 'center', width: 24 },
  scheduleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleDotDone: { backgroundColor: Colors.textMuted },
  scheduleDotCurrent: { backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.primary },
  scheduleDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  scheduleLine: { width: 2, flex: 1, backgroundColor: Colors.divider, marginVertical: 2 },
  scheduleCard: { flex: 1, paddingBottom: 20 },
  scheduleCardCurrent: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 12,
    marginTop: -4,
    marginBottom: 16,
  },
  scheduleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scheduleName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  currentPill: { backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  currentPillText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  scheduleDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  scheduleAmount: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginTop: 6 },
  collectionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  collectionsLabel: { fontSize: 12, color: Colors.textSecondary },
  collectionsPct: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    alignItems: 'center',
    gap: 8,
  },
  closeButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  closeButtonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  closeLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  footerHint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
});
