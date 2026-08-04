import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';

import EmptyState from '@/src/components/EmptyState';
import ErrorState from '@/src/components/ErrorState';
import { SkeletonLoader } from '@/src/components/SkeletonLoader';
import { fetchPaymentHistory } from '@/src/api/contributions';
import { fetchCycles } from '@/src/api/cycles';
import { fetchGroupDetail } from '@/src/api/groups';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import type { Group, GroupCycle, PaymentHistoryItem } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';

const screenWidth = Dimensions.get('window').width - 40;

const chartConfig = {
  backgroundGradientFrom: Colors.surface,
  backgroundGradientTo: Colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(24, 95, 165, ${opacity})`, // #185FA5
  labelColor: (opacity = 1) => `rgba(107, 107, 103, ${opacity})`,
  propsForBackgroundLines: { stroke: Colors.divider },
};

type Status = 'loading' | 'error' | 'ready';

/**
 * Group-scoped reports. Reached from GroupDetailScreen via the stack route
 * /group/[id]/reports?groupName=… — `id` is the groupId (path param) and
 * groupName is passed so the header paints instantly before the fetch lands.
 * Every figure here comes from the API for THIS group; never sample data.
 */
export default function ReportsScreen() {
  const { id: groupId, groupName } = useLocalSearchParams<{ id: string; groupName?: string }>();
  const { user } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [cycles, setCycles] = useState<GroupCycle[]>([]);
  const [contributions, setContributions] = useState<PaymentHistoryItem[]>([]);
  const [group, setGroup] = useState<Group | null>(null);

  const loadReports = useCallback(
    async (isRefresh = false) => {
      if (!groupId) return;
      if (isRefresh) setRefreshing(true);
      else setStatus('loading');
      try {
        // Load in parallel for speed.
        const [cycleRows, history, detail] = await Promise.all([
          fetchCycles(groupId),
          fetchPaymentHistory(),
          fetchGroupDetail(groupId),
        ]);
        setCycles(cycleRows);
        // The history endpoint returns every group; scope it to this one.
        setContributions(history.filter((c) => c.groupId === groupId));
        setGroup(detail);
        setStatus('ready');
      } catch {
        // Never fall back to sample data — show an honest, retryable error.
        setCycles([]);
        setContributions([]);
        setGroup(null);
        setStatus('error');
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const stats = useMemo(() => {
    // Oldest → newest so the growth chart reads left to right.
    const ordered = [...cycles].sort((a, b) => a.cycleNumber - b.cycleNumber);
    const completed = ordered.filter((c) => c.status === 'closed' || c.status === 'paid_out');

    const myTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
    const paidCycleNumbers = new Set(contributions.map((c) => c.cycleNumber));

    const me = group?.members.find((m) => m.userId === user?.id);
    const myReliability = me?.reliabilityScore ?? 0;

    // Cumulative collected across cycles.
    let running = 0;
    const growth = ordered.map((c) => {
      running += c.collectedTotal;
      return { label: `C${c.cycleNumber}`, value: running };
    });

    // Group-wide performance (admin section).
    const totalCollected = ordered.reduce((sum, c) => sum + c.collectedTotal, 0);
    const totalExpected = ordered.reduce((sum, c) => sum + c.expectedTotal, 0);
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

    return {
      ordered,
      completedCount: completed.length,
      myTotal,
      myReliability,
      paidCycleNumbers,
      growth,
      totalCollected,
      collectionRate,
    };
  }, [cycles, contributions, group, user]);

  const isAdmin = group?.role === 'organizer';

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>Reports</Text>
        {/* Group name subtitle — from the route param, so it shows immediately. */}
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {groupName ?? group?.name ?? ''}
        </Text>
      </View>
      <View style={{ width: 24 }} />
    </View>
  );

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.summaryRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.summaryCard}>
                <SkeletonLoader width="70%" height={11} />
                <SkeletonLoader width="55%" height={20} style={{ marginTop: 10 }} />
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <SkeletonLoader width="50%" height={15} />
            <SkeletonLoader width="100%" height={170} style={{ marginTop: 16 }} />
          </View>
          <View style={styles.card}>
            <SkeletonLoader width="45%" height={15} />
            <SkeletonLoader width="100%" height={120} style={{ marginTop: 16 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <ErrorState
          message="Could not load reports. Please check your connection."
          onRetry={() => loadReports()}
        />
      </SafeAreaView>
    );
  }

  if (stats.ordered.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadReports(true)} tintColor={Colors.primary} />
          }
        >
          <EmptyState
            icon="chart-bar"
            title="No reports yet"
            subtitle="Complete your first contribution cycle to see savings reports for this group"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadReports(true)} tintColor={Colors.primary} />
        }
      >
        {/* Section 1 — summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>My contributions</Text>
            <Text style={styles.summaryValue}>{formatCurrency(stats.myTotal)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Cycles completed</Text>
            <Text style={styles.summaryValue}>{stats.completedCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>My reliability</Text>
            <Text style={[styles.summaryValue, { color: reliabilityTone(stats.myReliability) }]}>
              {stats.myReliability}%
            </Text>
          </View>
        </View>

        {/* Section 2 — savings growth */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Savings growth</Text>
          <Text style={styles.cardSubtitle}>Cumulative amount collected per cycle</Text>
          {stats.growth.length >= 2 ? (
            <LineChart
              data={{
                labels: stats.growth.map((g) => g.label),
                datasets: [{ data: stats.growth.map((g) => g.value) }],
              }}
              width={screenWidth}
              height={180}
              chartConfig={chartConfig}
              bezier
              withInnerLines={false}
              withOuterLines={false}
              withDots
              style={styles.chart}
            />
          ) : (
            <Text style={styles.note}>
              {formatCurrency(stats.growth[0]?.value ?? 0)} collected so far. One more cycle will show the
              trend.
            </Text>
          )}
        </View>

        {/* Section 3 — contribution consistency (one bar per cycle) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My contribution consistency</Text>
          <Text style={styles.cardSubtitle}>Green means you paid that cycle, red means missed</Text>
          <View style={styles.barRow}>
            {stats.ordered.map((c) => {
              const paid = stats.paidCycleNumbers.has(c.cycleNumber);
              return (
                <View key={c.id} style={styles.barColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: paid ? 84 : 30,
                        backgroundColor: paid ? Colors.success : Colors.danger,
                      },
                    ]}
                  />
                  <Text style={styles.barLabel}>C{c.cycleNumber}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.legendLabel}>Paid</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.danger }]} />
              <Text style={styles.legendLabel}>Missed</Text>
            </View>
          </View>
        </View>

        {/* Section 4 — group performance (admin only) */}
        {isAdmin ? (
          <View style={styles.card}>
            <View style={styles.adminHeaderRow}>
              <MaterialCommunityIcons name="shield-account-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Group performance</Text>
            </View>
            <View style={styles.adminRow}>
              <Text style={styles.adminLabel}>Total collected (all time)</Text>
              <Text style={styles.adminValue}>{formatCurrency(stats.totalCollected)}</Text>
            </View>
            <View style={styles.adminRow}>
              <Text style={styles.adminLabel}>Average collection rate</Text>
              <Text style={[styles.adminValue, { color: reliabilityTone(stats.collectionRate) }]}>
                {stats.collectionRate}%
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// Same thresholds as the reliability bars: green >=90, amber 70-89, red <70.
function reliabilityTone(score: number): string {
  if (score >= 90) return Colors.success;
  if (score >= 70) return Colors.warning;
  return Colors.danger;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  container: { padding: 20, paddingBottom: 48 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },
  summaryValue: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginTop: 8 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  cardSubtitle: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 3 },
  chart: { borderRadius: 12, marginLeft: -16, marginTop: 10 },
  note: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 12, lineHeight: 18 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 18,
    minHeight: 100,
    flexWrap: 'wrap',
  },
  barColumn: { alignItems: 'center', gap: 6 },
  bar: { width: 26, borderRadius: 6 },
  barLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  legendRow: { flexDirection: 'row', gap: 18, marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: Colors.textSecondary },
  adminHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  adminRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: 6,
  },
  adminLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  adminValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
});
