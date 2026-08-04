import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNetworkError } from '@/src/api/client';
import { fetchGoals, type GoalsSummary } from '@/src/api/personalSusu';
import EmptyState from '@/src/components/EmptyState';
import ErrorState from '@/src/components/ErrorState';
import GoalCard from '@/src/components/GoalCard';
import { SkeletonLoader } from '@/src/components/SkeletonLoader';
import { Colors } from '@/src/constants/colors';
import type { PersonalGoal } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';

// Personal Susu home — every solo savings goal this user owns.
export default function PersonalSusuScreen() {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchGoals();
      setGoals(data.goals);
      setSummary(data.summary);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Cannot reach the server. Check your connection and try again.'
          : 'Could not load your savings goals.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload on focus so a contribution or collection made on the detail screen
  // is reflected the moment the user comes back.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>My Savings Goals</Text>
      <TouchableOpacity onPress={() => router.push('/personal-susu/create')} hitSlop={12}>
        <MaterialCommunityIcons name="plus-circle" size={26} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <SkeletonLoader key={i} height={150} borderRadius={16} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {header}
        <ErrorState message={error} onRetry={() => load()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {header}

      {goals.length === 0 ? (
        <EmptyState
          icon="target"
          title="No savings goals yet"
          subtitle="Create a personal goal and lock your money away until you reach your target — no group needed."
          actionLabel="Create my first goal"
          onAction={() => router.push('/personal-susu/create')}
        />
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListHeaderComponent={
            summary && summary.activeCount > 0 ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatCurrency(summary.totalSaved)}</Text>
                  <Text style={styles.summaryLabel}>Locked away</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.activeCount}</Text>
                  <Text style={styles.summaryLabel}>Active goals</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text
                    style={[
                      styles.summaryValue,
                      summary.readyToCollect > 0 && { color: Colors.success },
                    ]}
                  >
                    {summary.readyToCollect}
                  </Text>
                  <Text style={styles.summaryLabel}>Ready</Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <GoalCard goal={item} onPress={() => router.push(`/personal-susu/${item.id}`)} />
          )}
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  skeletonWrap: { padding: 20, gap: 14 },
  list: { padding: 20, gap: 14, paddingBottom: 40 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 4,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue: { fontSize: 17, fontWeight: '800', color: Colors.primaryDark },
  summaryLabel: { fontSize: 11.5, color: Colors.primaryDark, opacity: 0.75 },
  summaryDivider: { width: 1, height: 30, backgroundColor: Colors.primary, opacity: 0.2 },
});
