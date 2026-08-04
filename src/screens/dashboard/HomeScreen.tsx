import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AvatarInitials from '@/src/components/AvatarInitials';
import EmptyState from '@/src/components/EmptyState';
import ErrorState from '@/src/components/ErrorState';
import GroupCard from '@/src/components/GroupCard';
import SessionBanner from '@/src/components/SessionBanner';
import { GroupCardSkeleton, SkeletonLoader } from '@/src/components/SkeletonLoader';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import { useGroups } from '@/src/hooks/useGroups';
import { useNotifications } from '@/src/hooks/useNotifications';
import type { Group, NotificationType } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';

// Icon + colour per notification type, used to colour each recent-activity row.
const ACTIVITY_ICONS: Record<NotificationType, { icon: keyof typeof MaterialCommunityIcons.glyphMap; bg: string; fg: string }> = {
  payment: { icon: 'cash-check', bg: Colors.successLight, fg: Colors.success },
  payout: { icon: 'star-circle-outline', bg: Colors.accentLight, fg: Colors.accent },
  reminder: { icon: 'bell-ring-outline', bg: Colors.primaryLight, fg: Colors.primary },
  warning: { icon: 'alert', bg: Colors.warningLight, fg: Colors.warning },
  info: { icon: 'information-outline', bg: Colors.primaryLight, fg: Colors.primary },
  overdue: { icon: 'alert-circle-outline', bg: Colors.dangerLight, fg: Colors.danger },
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { groups, isLoading, error: groupsError, refresh } = useGroups();
  const {
    items: notifications,
    unreadCount,
    isLoading: notificationsLoading,
    loaded: notificationsLoaded,
    refresh: refreshNotifications,
  } = useNotifications();

  // The 5 most recent items double as the dashboard's activity feed.
  const recentActivity = notifications.slice(0, 5);

  // All derived from real API groups. A brand new user has [] → GHS 0.00.
  const totalSavings = useMemo(() => groups.reduce((sum, g) => sum + g.collected, 0), [groups]);

  // Only groups with an actual open cycle have a contribution due.
  const nextContributionGroup = useMemo(
    () =>
      groups
        .filter((g) => g.hasOpenCycle)
        .sort((a, b) => a.nextContributionInHours - b.nextContributionInHours)[0],
    [groups],
  );

  // Only a group with a real named recipient has a scheduled payout.
  const payoutGroup = useMemo(
    () => groups.find((g) => g.hasOpenCycle && !!g.currentRecipientName),
    [groups],
  );

  const openGroup = (group: Group) => router.push(`/group/${group.id}`);

  const firstName = (user?.name ?? 'Saver').split(' ')[0];
  const initialsSource = user?.name ?? 'Saver';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              refresh();
              refreshNotifications();
            }}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {/* Own avatar → Profile tab. */}
            <AvatarInitials
              name={initialsSource}
              photoUrl={user?.profilePhotoUrl}
              size={40}
              onPress={() => router.push('/(tabs)/profile')}
            />
            <Text style={styles.greeting}>
              {greeting()}, {firstName}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/notifications')} hitSlop={10}>
            <View>
              <MaterialCommunityIcons name="bell-outline" size={24} color={Colors.textPrimary} />
              {unreadCount > 0 ? <View style={styles.badgeDot} /> : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* Update 6 — fresh-login notice, auto-dismisses after 5s. */}
        <SessionBanner />

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total savings</Text>
          <Text style={styles.balanceValue}>{formatCurrency(totalSavings)}</Text>
          <View style={styles.balanceMetaRow}>
            <MaterialCommunityIcons name="account-group" size={16} color="rgba(255,255,255,0.85)" />
            <Text style={styles.balanceMeta}>Across {groups.length} groups</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Next contribution</Text>
            {nextContributionGroup ? (
              <>
                <Text style={styles.statValue}>
                  {formatCurrency(nextContributionGroup.contributionAmount)}
                </Text>
                <Text style={styles.statSub}>In {nextContributionGroup.nextContributionInHours}h</Text>
              </>
            ) : (
              <Text style={styles.statEmpty}>No upcoming contributions</Text>
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Next payout</Text>
            {payoutGroup ? (
              <>
                <Text style={styles.statValue} numberOfLines={1}>
                  {payoutGroup.currentRecipientName}
                </Text>
                <Text style={styles.statSubGreen}>Cycle {payoutGroup.cycle}</Text>
              </>
            ) : (
              <Text style={styles.statEmpty}>No payout scheduled</Text>
            )}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/groups')}>
            <Text style={styles.sectionLink}>See all</Text>
          </TouchableOpacity>
        </View>

        {isLoading && groups.length === 0 ? (
          <View style={{ gap: 12 }}>
            <GroupCardSkeleton />
            <GroupCardSkeleton />
          </View>
        ) : groupsError && groups.length === 0 ? (
          <ErrorState message={groupsError} onRetry={refresh} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="account-group-outline"
            title="You have no groups yet"
            subtitle="Create your own susu circle or join one with an invite code from a friend."
            actionLabel="Create a group"
            onAction={() => router.push('/group/create')}
            secondaryActionLabel="Join a group"
            onSecondaryAction={() => router.push('/join-group')}
          />
        ) : (
          <FlatList
            data={groups}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 12, paddingRight: 8 }}
            renderItem={({ item }) => <GroupCard group={item} onPress={openGroup} width={240} />}
          />
        )}

        <Text style={[styles.sectionTitle, { marginTop: 28, marginBottom: 12 }]}>Recent Activity</Text>
        {notificationsLoading && !notificationsLoaded ? (
          <View style={styles.activityCard}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.activityRow, i < 2 && styles.activityDivider]}>
                <SkeletonLoader width={36} height={36} borderRadius={18} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonLoader width="55%" height={13} />
                  <SkeletonLoader width="80%" height={10} />
                </View>
              </View>
            ))}
          </View>
        ) : recentActivity.length === 0 ? (
          <View style={styles.activityEmpty}>
            <MaterialCommunityIcons name="bell-outline" size={30} color={Colors.textMuted} />
            <Text style={styles.activityEmptyTitle}>No recent activity yet</Text>
            <Text style={styles.activityEmptySub}>
              Your contributions, payouts, and group updates will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.activityCard}>
            {recentActivity.map((activity, idx) => {
              const meta = ACTIVITY_ICONS[activity.type];
              return (
                <View
                  key={activity.id}
                  style={[styles.activityRow, idx < recentActivity.length - 1 && styles.activityDivider]}
                >
                  <View style={[styles.activityIcon, { backgroundColor: meta.bg }]}>
                    <MaterialCommunityIcons name={meta.icon} size={18} color={meta.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activitySubtitle} numberOfLines={2}>{activity.body}</Text>
                  </View>
                  <Text style={styles.activityTime}>{activity.timestamp}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/(tabs)/groups')}>
        <MaterialCommunityIcons name="plus" size={26} color={Colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  balanceCard: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  balanceValue: { color: Colors.white, fontSize: 30, fontWeight: '800', marginTop: 6 },
  balanceMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  balanceMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  statLabel: { fontSize: 12, color: Colors.textSecondary },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginTop: 6 },
  statSub: { fontSize: 12, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  statSubGreen: { fontSize: 12, color: Colors.success, marginTop: 4, fontWeight: '600' },
  statEmpty: { fontSize: 13, color: Colors.textSecondary, marginTop: 8, lineHeight: 18 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sectionLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  activityCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  activityDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  activitySubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  activityTime: { fontSize: 11, color: Colors.textMuted },
  activityEmpty: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 6,
  },
  activityEmptyTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  activityEmptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: Colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
