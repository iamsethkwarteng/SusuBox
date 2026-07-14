import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileAvatar from '@/src/components/ProfileAvatar';
import ReliabilityBar from '@/src/components/ReliabilityBar';
import StreakBadge, { earnedTiers } from '@/src/components/StreakBadge';
import VerificationStatus from '@/src/components/VerificationStatus';
import { Colors } from '@/src/constants/colors';
import { contributionHistory } from '@/src/constants/sampleData';
import { useAuth } from '@/src/hooks/useAuth';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { formatDate } from '@/src/utils/formatDate';
import { reliabilityLabel } from '@/src/utils/reliabilityColor';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const badges = earnedTiers(user.streak);

  const handleViewPenalty = () => {
    Alert.alert(
      'Penalty owed',
      `You currently owe ${formatCurrency(user.penaltyDebt)} in late-contribution penalties. This amount is deducted from your next payout automatically.`,
    );
  };

  const handleEarlyPayout = () => {
    Alert.alert('Request early payout', 'Submit a request to receive your payout ahead of your scheduled rotation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Request',
        onPress: () => Alert.alert('Request sent', 'Your organizer will review your early payout request.'),
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.avatarWrap}>
          {/* Update 4 — editable circular avatar with WhatsApp-style + button. */}
          <ProfileAvatar name={user.name} photoUrl={user.profilePhotoUrl} size={92} />
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>

        {/* Update 5 — ID verification status section. */}
        <VerificationStatus user={user} />

        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreLabel}>Reliability Score</Text>
            <Text style={styles.scoreValue}>{user.reliabilityScore}%</Text>
          </View>
          <ReliabilityBar score={user.reliabilityScore} showLabel={false} height={8} />
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="fire" size={20} color={Colors.accent} />
            <Text style={styles.statValue}>{user.streak} Cycles</Text>
            <Text style={styles.statSub}>In a row</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="shield-star" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{reliabilityLabel(user.reliabilityScore)}</Text>
            <Text style={styles.statSub}>Contributor</Text>
          </View>
        </View>

        {/* Mechanism 9 — the user's own earned streak badges. */}
        {badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {badges.map((tier) => (
              <StreakBadge key={tier} tier={tier} />
            ))}
          </View>
        ) : null}

        {user.penaltyDebt > 0 ? (
          <TouchableOpacity style={styles.penaltyRow} activeOpacity={0.8} onPress={handleViewPenalty}>
            <MaterialCommunityIcons name="alert" size={18} color={Colors.danger} />
            <Text style={styles.penaltyText}>{formatCurrency(user.penaltyDebt)} penalty owed</Text>
            <View style={{ flex: 1 }} />
            <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.danger} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.arrearsRow}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={18} color={Colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.arrearsLabel}>Arrears</Text>
            <Text style={styles.arrearsSub}>Current cycle payment</Text>
          </View>
          <Text style={styles.arrearsValue}>{formatCurrency(user.arrears)}</Text>
        </View>

        <TouchableOpacity style={styles.earlyPayoutButton} activeOpacity={0.85} onPress={handleEarlyPayout}>
          <MaterialCommunityIcons name="repeat" size={18} color={Colors.primary} />
          <Text style={styles.earlyPayoutLabel}>Request Early Payout</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Contribution History</Text>
        <View style={styles.historyCard}>
          {contributionHistory.map((entry, idx) => (
            <View key={entry.id} style={[styles.historyRow, idx < contributionHistory.length - 1 && styles.historyDivider]}>
              <View style={styles.historyIcon}>
                <MaterialCommunityIcons name="check-circle" size={18} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>{entry.label}</Text>
                <Text style={styles.historySub}>{formatDate(entry.date)}</Text>
              </View>
              <Text style={styles.historyAmount}>+ {formatCurrency(entry.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.menuList}>
          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/notifications')}>
            <MaterialCommunityIcons name="bell-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.menuLabel}>Notifications</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color={Colors.danger} />
            <Text style={[styles.menuLabel, { color: Colors.danger }]}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 24, paddingTop: 20, paddingBottom: 48 },
  avatarWrap: { alignItems: 'center', marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  email: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  scoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginTop: 20,
    gap: 10,
  },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreLabel: { fontSize: 13, color: Colors.textSecondary },
  scoreValue: { fontSize: 16, fontWeight: '800', color: Colors.success },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  statSub: { fontSize: 11, color: Colors.textSecondary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  penaltyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  penaltyText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  arrearsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 12,
  },
  arrearsLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  arrearsSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  arrearsValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  earlyPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
  },
  earlyPayoutLabel: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginTop: 28, marginBottom: 10 },
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  historyDivider: { borderBottomWidth: 1, borderBottomColor: Colors.divider },
  historyIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  historySub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  historyAmount: { fontSize: 13, fontWeight: '700', color: Colors.success },
  menuList: { marginTop: 28, gap: 4 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
});
