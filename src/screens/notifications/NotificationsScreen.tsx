import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AvatarInitials from '@/src/components/AvatarInitials';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { isNetworkError } from '@/src/api/client';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/src/api/notifications';
import { currentUser, notifications as sampleNotifications } from '@/src/constants/sampleData';
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
  const [filter, setFilter] = useState<FilterTab>('All');
  const [items, setItems] = useState<AppNotification[]>(sampleNotifications);
  const [refreshing, setRefreshing] = useState(false);

  const visible = items.filter((n) => matchesFilter(n, filter));
  const unreadCount = items.filter((n) => !n.read).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchNotifications();
      setItems(fresh);
    } catch (error) {
      if (!isNetworkError(error)) showToast('Could not refresh — check your connection');
      // DEMO FALLBACK / offline: keep current list.
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Optimistic read: flip local state instantly, sync in the background, and
  // revert + toast if the server rejects.
  const markRead = useCallback(
    async (id: string) => {
      const target = items.find((n) => n.id === id);
      if (!target || target.read) return;
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      try {
        await markNotificationRead(id);
      } catch (error) {
        if (!isNetworkError(error)) {
          setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
          showToast('Could not update — check your connection');
        }
      }
    },
    [items],
  );

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    const snapshot = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch (error) {
      if (!isNetworkError(error)) {
        setItems(snapshot);
        showToast('Could not update — check your connection');
      }
    }
  }, [items, unreadCount]);

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
          <AvatarInitials name={currentUser.name} size={32} />
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

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        renderItem={({ item }) => {
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
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="bell-off-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No notifications in this category.</Text>
          </View>
        }
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
  emptyState: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { color: Colors.textSecondary, fontSize: 13 },
});
