import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AvatarInitials from '@/src/components/AvatarInitials';
import { SkeletonLoader } from '@/src/components/SkeletonLoader';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import { useNotifications } from '@/src/hooks/useNotifications';
import type { AppNotification, NotificationType } from '@/src/types';

type FilterTab = 'All' | 'Payments' | 'Reminders' | 'Alerts';

const TYPE_META: Record<NotificationType, { icon: keyof typeof MaterialCommunityIcons.glyphMap; bg: string; fg: string }> = {
  payment: { icon: 'cash-check', bg: Colors.successLight, fg: Colors.success },
  payout: { icon: 'star-circle-outline', bg: Colors.accentLight, fg: Colors.accent },
  reminder: { icon: 'bell-ring-outline', bg: Colors.primaryLight, fg: Colors.primary },
  warning: { icon: 'alert', bg: Colors.warningLight, fg: Colors.warning },
  info: { icon: 'information-outline', bg: Colors.primaryLight, fg: Colors.primary },
  overdue: { icon: 'alert-circle', bg: Colors.dangerLight, fg: Colors.danger },
};

const FILTER_TABS: FilterTab[] = ['All', 'Payments', 'Reminders', 'Alerts'];

function matchesFilter(notification: AppNotification, filter: FilterTab): boolean {
  if (filter === 'All') return true;
  if (filter === 'Payments') return notification.type === 'payment' || notification.type === 'payout';
  if (filter === 'Reminders') return notification.type === 'reminder' || notification.type === 'warning';
  return notification.type === 'overdue' || notification.type === 'info';
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterTab>('All');
  const {
    items,
    unreadCount,
    isLoading,
    error,
    loaded,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  const visible = items.filter((n) => matchesFilter(n, filter));

  const renderRow = (item: AppNotification) => {
    const meta = TYPE_META[item.type];
    return (
      <TouchableOpacity
        style={[styles.row, !item.read && styles.rowUnread]}
        activeOpacity={0.7}
        onPress={() => markRead(item.id)}
      >
        <View style={[styles.icon, { backgroundColor: meta.bg }]}>
          <MaterialCommunityIcons name={meta.icon} size={20} color={meta.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <Text style={styles.rowBody} numberOfLines={2}>{item.body}</Text>
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.rowTime}>{item.timestamp}</Text>
          {!item.read ? <View style={styles.unreadDot} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} hitSlop={8}>
            <Text style={styles.markAllLabel}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          // Own avatar → Profile tab.
          <AvatarInitials
            name={user?.name ?? 'Saver'}
            photoUrl={user?.profilePhotoUrl}
            size={32}
            onPress={() => router.push('/(tabs)/profile')}
          />
        )}
      </View>

      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterChip, filter === tab && styles.filterChipActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterLabel, filter === tab && styles.filterLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && !loaded ? (
        // Loading skeleton — placeholder rows while the first fetch runs.
        <View style={{ paddingHorizontal: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <SkeletonLoader width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonLoader width="45%" height={13} />
                <SkeletonLoader width="85%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : error && items.length === 0 ? (
        // Fetch failed and we have nothing to show — empty state + retry.
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="wifi-off" size={30} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Couldn&apos;t load notifications</Text>
          <Text style={styles.emptySub}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refresh()} activeOpacity={0.85}>
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        // Brand new user with no notifications yet.
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="bell-outline" size={30} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>
            You will be notified about payments, group updates, and reminders here
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refresh()} tintColor={Colors.primary} />}
          renderItem={({ item }) => renderRow(item)}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bell-off-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.emptySub}>No notifications in this category.</Text>
            </View>
          }
        />
      )}
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
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  markAllLabel: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterLabelActive: { color: Colors.white },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowUnread: { backgroundColor: Colors.primaryLight },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowBody: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 17 },
  rowMeta: { alignItems: 'flex-end', gap: 6 },
  rowTime: { fontSize: 11, color: Colors.textMuted },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  emptyState: { alignItems: 'center', gap: 6, paddingTop: 72, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 6 },
  emptySub: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryButton: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  retryLabel: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});
