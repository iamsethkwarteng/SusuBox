import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart } from 'react-native-chart-kit';

import AvatarInitials from '@/src/components/AvatarInitials';
import { Colors } from '@/src/constants/colors';
import { currentUser, reportsData } from '@/src/constants/sampleData';
import { formatCompactCurrency } from '@/src/utils/formatCurrency';

type RangeTab = 'This month' | 'Last 3 months' | 'All time';
const RANGE_TABS: RangeTab[] = ['This month', 'Last 3 months', 'All time'];

const screenWidth = Dimensions.get('window').width - 40;

const chartConfig = {
  backgroundGradientFrom: Colors.surface,
  backgroundGradientTo: Colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(24, 95, 165, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 107, 103, ${opacity})`,
  propsForBackgroundLines: { stroke: Colors.divider },
};

export default function ReportsScreen() {
  const [range, setRange] = useState<RangeTab>('This month');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reports</Text>
        <AvatarInitials name={currentUser.name} size={32} />
      </View>

      <View style={styles.tabRow}>
        {RANGE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabChip, range === tab && styles.tabChipActive]}
            onPress={() => setRange(tab)}
          >
            <Text style={[styles.tabLabel, range === tab && styles.tabLabelActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardTitle}>Savings Growth</Text>
            <Text style={styles.cardSubtitle}>Cumulative contributions</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.cardValue}>{formatCompactCurrency(reportsData.savingsGrowth.total)}</Text>
            <Text style={styles.cardChange}>
              <MaterialCommunityIcons name="trending-up" size={12} color={Colors.success} /> +
              {reportsData.savingsGrowth.changePct}%
            </Text>
          </View>
        </View>
        <LineChart
          data={{
            labels: reportsData.savingsGrowth.labels,
            datasets: [{ data: reportsData.savingsGrowth.values }],
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
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment Consistency</Text>
        <BarChart
          data={{
            labels: reportsData.paymentConsistency.labels,
            datasets: [{ data: reportsData.paymentConsistency.onTime.map((v) => (v === 1 ? 100 : 40)) }],
          }}
          width={screenWidth}
          height={180}
          fromZero
          showValuesOnTopOfBars={false}
          withInnerLines={false}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(29, 158, 117, ${opacity})`,
          }}
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix=""
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.card, styles.halfCard, styles.penaltyCard]}>
          <Text style={styles.penaltyLabel}>Penalties</Text>
          <Text style={styles.penaltyValue}>{formatCompactCurrency(reportsData.penalties.total)}</Text>
          <Text style={styles.penaltySub}>{reportsData.penalties.count} late payments</Text>
        </View>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.cardTitle}>Methods</Text>
          <View style={styles.methodsList}>
            {reportsData.methods.map((method) => (
              <View key={method.name} style={styles.methodRow}>
                <View style={[styles.methodDot, { backgroundColor: method.color }]} />
                <Text style={styles.methodLabel}>{method.name}</Text>
                <Text style={styles.methodPct}>{method.pct}%</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Monthly Insights</Text>
      <View style={styles.insightCard}>
        <View style={styles.insightRow}>
          <View style={[styles.insightIcon, { backgroundColor: Colors.successLight }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={18} color={Colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightTitle}>Top Performer status reached</Text>
            <Text style={styles.insightBody}>You were in the top 5% of consistent savers this month.</Text>
          </View>
        </View>
        <View style={[styles.insightRow, { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 14 }]}>
          <View style={[styles.insightIcon, { backgroundColor: Colors.primaryLight }]}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightTitle}>{formatCompactCurrency(1200)} Potential Dividend</Text>
            <Text style={styles.insightBody}>
              Your current reliability score suggests an estimated 8.5% p.a. payout bonus.
            </Text>
          </View>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 20, paddingTop: 16, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  tabLabelActive: { color: Colors.white },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  cardSubtitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  cardValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  cardChange: { fontSize: 11, color: Colors.success, fontWeight: '700', marginTop: 2 },
  chart: { borderRadius: 12, marginLeft: -16 },
  row: { flexDirection: 'row', gap: 16 },
  halfCard: { flex: 1 },
  penaltyCard: { backgroundColor: Colors.warningLight, borderColor: Colors.warning },
  penaltyLabel: { fontSize: 12, color: Colors.warning, fontWeight: '700' },
  penaltyValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 8 },
  penaltySub: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  methodsList: { gap: 10, marginTop: 10 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodDot: { width: 8, height: 8, borderRadius: 4 },
  methodLabel: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  methodPct: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginTop: 8, marginBottom: 12 },
  insightCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 14,
  },
  insightRow: { flexDirection: 'row', gap: 12 },
  insightIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  insightBody: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
});
