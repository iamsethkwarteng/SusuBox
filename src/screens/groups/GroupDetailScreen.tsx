import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AvatarInitials from '@/src/components/AvatarInitials';
import { shareGroupInvite } from '@/src/components/GroupCard';
import IDVerifiedBadge from '@/src/components/IDVerifiedBadge';
import MemberRow from '@/src/components/MemberRow';
import ReliabilityBar from '@/src/components/ReliabilityBar';
import { MemberRowSkeleton } from '@/src/components/SkeletonLoader';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { isNetworkError } from '@/src/api/client';
import { approveJoinRequest, declineJoinRequest } from '@/src/api/groups';
import { useGroup, useGroups } from '@/src/hooks/useGroups';
import MemberProfileSheet from '@/src/screens/groups/MemberProfileSheet';
import type { ContributionStatus, GroupMember, JoinRequest } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { formatDate } from '@/src/utils/formatDate';

type Tab = 'current' | 'rotation' | 'history' | 'requests';
type StatusFilter = ContributionStatus | 'all';

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'All members',
  paid: 'Paid',
  pending: 'Pending',
  late: 'Late',
};

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isLoading } = useGroups();
  const group = useGroup(id);
  const [tab, setTab] = useState<Tab>('current');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
  // Local mirror of pending requests so approve/decline update the UI
  // instantly; refreshed from the group whenever it loads.
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [approvedMembers, setApprovedMembers] = useState<GroupMember[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  useEffect(() => {
    if (group) setRequests(group.pendingRequests);
  }, [group]);

  if (!group) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ padding: 20, gap: 12 }}>
          <MemberRowSkeleton />
          <MemberRowSkeleton />
          <MemberRowSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = group.role === 'organizer';
  const lateMember = group.members.find((m) => m.status === 'late' && !m.removed);
  const lateAmount = lateMember
    ? Math.round(group.contributionAmount * (1 - lateMember.progressPct / 100)) + lateMember.penaltyDebt
    : 0;

  const handleTabPress = (next: Tab) => {
    if (next === 'rotation') {
      router.push(`/group/${group.id}/rotation`);
      return;
    }
    setTab(next);
  };

  const handleFilter = () => {
    const options: StatusFilter[] = ['all', 'paid', 'pending', 'late'];
    Alert.alert('Filter members', 'Show members with status:', [
      ...options.map((option) => ({
        text: FILTER_LABELS[option],
        onPress: () => setStatusFilter(option),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleApprove = async (request: JoinRequest) => {
    try {
      await approveJoinRequest(group.id, request.id);
    } catch (error) {
      if (!isNetworkError(error)) {
        showToast('Could not approve — try again');
        return;
      }
      // DEMO FALLBACK: no backend — apply locally.
    }
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
    // Approved member appears in the Current Cycle tab immediately.
    setApprovedMembers((prev) => [
      ...prev,
      {
        id: `approved-${request.id}`,
        userId: request.userId,
        name: request.name,
        role: 'member',
        status: 'pending',
        progressPct: 0,
        reliabilityScore: request.reliabilityScore ?? 50,
        penaltyDebt: 0,
        streak: 0,
      },
    ]);
    showToast('Member approved and added to group');
  };

  const handleDecline = async (request: JoinRequest) => {
    try {
      await declineJoinRequest(group.id, request.id);
    } catch (error) {
      if (!isNetworkError(error)) {
        showToast('Could not decline — try again');
        return;
      }
    }
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
    showToast(`${request.name} has been declined`);
  };

  const handleMemberRemoved = (member: GroupMember) => {
    setRemovedIds((prev) => [...prev, member.id]);
    setSelectedMember(null);
  };

  const allMembers = [...group.members, ...approvedMembers].map((m) =>
    removedIds.includes(m.id) ? { ...m, removed: true } : m,
  );
  const visibleMembers =
    statusFilter === 'all'
      ? allMembers
      : allMembers.filter((m) => m.status === statusFilter && !m.removed);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'current', label: 'Current cycle' },
    { key: 'rotation', label: 'Rotation' },
    { key: 'history', label: 'History' },
    // Requests tab is admin-only — regular members never manage joins.
    ...(isAdmin ? [{ key: 'requests' as Tab, label: 'Requests' }] : []),
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{group.name}</Text>
          <View style={styles.headerMetaRow}>
            <Text style={styles.headerMeta}>Cycle {group.cycle}</Text>
            <View style={styles.openBadge}>
              <Text style={styles.openBadgeText}>{group.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>
        {/* Update 8 — share invite from the header, visible to ALL members. */}
        <TouchableOpacity onPress={() => shareGroupInvite(group)} hitSlop={10}>
          <MaterialCommunityIcons name="share-variant" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={tab === 'current' ? visibleMembers : []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {/* Mechanism 2 — payout freeze banner, visible to every member. */}
            {group.payoutFrozen && lateMember ? (
              <View style={styles.freezeBanner}>
                <MaterialCommunityIcons name="lock-alert-outline" size={18} color={Colors.danger} />
                <Text style={styles.freezeText}>
                  Payout blocked — {lateMember.name} has {formatCurrency(lateAmount)} in unpaid contributions
                </Text>
              </View>
            ) : null}

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Collected</Text>
                <Text style={styles.statValue}>{formatCurrency(group.collected)}</Text>
                <View style={styles.track}>
                  <View
                    style={[styles.fill, { width: `${Math.min(100, (group.collected / group.expected) * 100)}%` }]}
                  />
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Expected</Text>
                <Text style={styles.statValueDark}>{formatCurrency(group.expected)}</Text>
                <Text style={styles.statSub}>Next: {group.nextContributionInHours}h</Text>
              </View>
            </View>

            <View style={styles.recipientBanner}>
              <View>
                <Text style={styles.recipientLabel}>Current Recipient</Text>
                <Text style={styles.recipientName}>{group.currentRecipientName}</Text>
              </View>
              <AvatarInitials name={group.currentRecipientName} size={48} />
            </View>

            <View style={styles.tabRow}>
              {tabs.map((t) => (
                <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => handleTabPress(t.key)}>
                  <View style={styles.tabLabelRow}>
                    <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
                    {t.key === 'requests' && requests.length > 0 ? (
                      <View style={styles.requestBadge}>
                        <Text style={styles.requestBadgeText}>{requests.length}</Text>
                      </View>
                    ) : null}
                  </View>
                  {tab === t.key ? <View style={styles.tabUnderline} /> : null}
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'current' ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Member payments</Text>
                <TouchableOpacity style={styles.filterRow} onPress={handleFilter} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="filter-variant" size={16} color={Colors.primary} />
                  <Text style={styles.filterLabel}>
                    {statusFilter === 'all' ? 'Filter' : FILTER_LABELS[statusFilter]}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {tab === 'history' ? (
              <View style={{ gap: 12, marginTop: 12 }}>
                {group.history.map((entry) => (
                  <View key={entry.cycle} style={styles.historyRow}>
                    <View style={styles.historyIcon}>
                      <MaterialCommunityIcons
                        name={entry.completed ? 'check-circle' : 'clock-outline'}
                        size={20}
                        color={entry.completed ? Colors.success : Colors.accent}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle}>Cycle {entry.cycle} · {entry.recipientName}</Text>
                      <Text style={styles.historySub}>{formatDate(entry.date)}</Text>
                    </View>
                    <Text style={styles.historyAmount}>{formatCurrency(entry.amount)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {tab === 'requests' ? (
              <View style={{ gap: 12, marginTop: 12, paddingHorizontal: 20 }}>
                {requests.length === 0 ? (
                  <View style={styles.emptyRequests}>
                    <MaterialCommunityIcons name="account-check-outline" size={28} color={Colors.textMuted} />
                    <Text style={styles.emptyRequestsText}>No pending join requests</Text>
                  </View>
                ) : (
                  requests.map((request) => (
                    <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestTop}>
                        <AvatarInitials name={request.name} size={42} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={styles.requestNameRow}>
                            <Text style={styles.requestName}>{request.name}</Text>
                            {request.idVerified ? <IDVerifiedBadge /> : null}
                          </View>
                          {request.reliabilityScore !== undefined ? (
                            <ReliabilityBar score={request.reliabilityScore} />
                          ) : (
                            <Text style={styles.requestNew}>New to SusuTrack</Text>
                          )}
                          <Text style={styles.requestDate}>Requested {formatDate(request.requestedAt)}</Text>
                        </View>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={styles.approveButton}
                          onPress={() => handleApprove(request)}
                          activeOpacity={0.85}
                        >
                          <MaterialCommunityIcons name="check" size={16} color={Colors.white} />
                          <Text style={styles.approveLabel}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineButton}
                          onPress={() => handleDecline(request)}
                          activeOpacity={0.85}
                        >
                          <MaterialCommunityIcons name="close" size={16} color={Colors.danger} />
                          <Text style={styles.declineLabel}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <MemberRow member={item} onPress={item.removed ? undefined : setSelectedMember} />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          tab === 'current' && isLoading ? (
            <View style={{ paddingHorizontal: 20, gap: 12 }}>
              <MemberRowSkeleton />
              <MemberRowSkeleton />
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.payButton}
        activeOpacity={0.85}
        onPress={() => router.push(`/payment?groupId=${group.id}`)}
      >
        <MaterialCommunityIcons name="cash-multiple" size={20} color={Colors.white} />
        <Text style={styles.payButtonLabel}>Pay contribution</Text>
      </TouchableOpacity>

      <MemberProfileSheet
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        isAdmin={isAdmin}
        groupId={group.id}
        onRemoved={handleMemberRemoved}
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
    backgroundColor: Colors.background,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  headerMeta: { fontSize: 12, color: Colors.textSecondary },
  openBadge: { backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  openBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.success },
  freezeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 16,
  },
  freezeText: { flex: 1, color: Colors.danger, fontSize: 13, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 12, padding: 20 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  statLabel: { fontSize: 12, color: Colors.textSecondary },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginTop: 6, marginBottom: 10 },
  statValueDark: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginTop: 6, marginBottom: 10 },
  statSub: { fontSize: 12, color: Colors.textSecondary },
  track: { height: 5, borderRadius: 3, backgroundColor: Colors.divider, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: Colors.success },
  recipientBanner: {
    marginHorizontal: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  recipientLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  recipientName: { color: Colors.white, fontSize: 18, fontWeight: '800', marginTop: 4 },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: 16,
  },
  tabItem: { marginRight: 20, paddingBottom: 10 },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary, fontWeight: '800' },
  tabUnderline: { height: 2, backgroundColor: Colors.primary, marginTop: 8, borderRadius: 1 },
  requestBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  requestBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterLabel: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginHorizontal: 20,
  },
  historyIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  historySub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  historyAmount: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  emptyRequests: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyRequestsText: { color: Colors.textSecondary, fontSize: 13 },
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  requestTop: { flexDirection: 'row', gap: 12 },
  requestNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  requestName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  requestNew: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  requestDate: { fontSize: 11, color: Colors.textMuted },
  requestActions: { flexDirection: 'row', gap: 10 },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 11,
  },
  approveLabel: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 12,
    paddingVertical: 10,
  },
  declineLabel: { color: Colors.danger, fontSize: 13, fontWeight: '700' },
  payButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: Colors.success,
    borderRadius: 28,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: Colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  payButtonLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
