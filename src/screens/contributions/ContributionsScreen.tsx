import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AvatarInitials from '@/src/components/AvatarInitials';
import { SkeletonLoader } from '@/src/components/SkeletonLoader';
import { fetchPaymentHistory } from '@/src/api/contributions';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import type { PaymentHistoryItem } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { formatDate } from '@/src/utils/formatDate';

type Status = 'loading' | 'error' | 'ready';

// Payment-method → icon. Covers Paystack's common Ghanaian channels.
function methodIcon(method: string | null): keyof typeof MaterialCommunityIcons.glyphMap {
  const m = (method ?? '').toLowerCase();
  if (m.includes('mobile') || m.includes('momo')) return 'cellphone';
  if (m.includes('bank')) return 'bank-outline';
  if (m.includes('card')) return 'credit-card-outline';
  return 'cash-check';
}

function methodLabel(method: string | null): string {
  const m = (method ?? '').toLowerCase();
  if (m.includes('mobile') || m.includes('momo')) return 'Mobile money';
  if (m.includes('bank')) return 'Bank transfer';
  if (m.includes('card')) return 'Card';
  return 'Payment';
}

export default function ContributionsScreen() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    try {
      const history = await fetchPaymentHistory();
      setItems(history); // Real data only — a new user gets [] and the empty state.
      setStatus('ready');
    } catch {
      // Never fall back to demo data — surface an empty state with retry.
      setStatus('error');
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = items.reduce((sum, c) => sum + c.amount, 0);

  const renderRow = (item: PaymentHistoryItem) => (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={methodIcon(item.method)} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item.groupName}</Text>
        <Text style={styles.rowSub}>
          Cycle {item.cycleNumber} · {methodLabel(item.method)}
          {item.isArrears ? ' · Arrears' : ''}
        </Text>
        {item.reference ? (
          <Text style={styles.rowRef} numberOfLines={1}>
            Ref: {item.reference}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
        <Text style={styles.rowDate}>{formatDate(item.date)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contributions</Text>
        {/* Own avatar → Profile tab. */}
        <AvatarInitials
          name={user?.name ?? 'Saver'}
          photoUrl={user?.profilePhotoUrl}
          size={32}
          onPress={() => router.push('/(tabs)/profile')}
        />
      </View>

      {status === 'loading' ? (
        <View style={{ paddingHorizontal: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <SkeletonLoader width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonLoader width="50%" height={13} />
                <SkeletonLoader width="75%" height={10} />
              </View>
              <SkeletonLoader width={56} height={14} />
            </View>
          ))}
        </View>
      ) : status === 'error' ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="wifi-off" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Couldn&apos;t load contributions</Text>
          <Text style={styles.emptySub}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load()} activeOpacity={0.85}>
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="wallet-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No contributions yet</Text>
          <Text style={styles.emptySub}>
            Your payment history will appear here once you make your first contribution
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
          }
          ListHeaderComponent={
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total contributed</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
              <Text style={styles.totalMeta}>
                {items.length} {items.length === 1 ? 'payment' : 'payments'}
              </Text>
            </View>
          }
          renderItem={({ item }) => renderRow(item)}
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
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  totalCard: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  totalLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  totalValue: { color: Colors.white, fontSize: 28, fontWeight: '800', marginTop: 6 },
  totalMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rowRef: { fontSize: 10, color: Colors.textMuted, marginTop: 3 },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { fontSize: 14, fontWeight: '800', color: Colors.success },
  rowDate: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  emptyState: { alignItems: 'center', gap: 6, paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptySub: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryButton: {
    marginTop: 18,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  retryLabel: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});
