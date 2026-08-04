import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import type { PersonalGoal } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';

// Status line + tint per goal state. `isUnlocked` only matters while active —
// a completed goal has already been paid out.
function statusFor(goal: PersonalGoal): { label: string; icon: string; color: string } {
  if (goal.status === 'completed') {
    return { label: 'Collected', icon: 'check-circle', color: Colors.success };
  }
  if (goal.status === 'withdrawn_early') {
    return { label: 'Withdrawn early', icon: 'alert-circle-outline', color: Colors.warning };
  }
  if (goal.status === 'cancelled') {
    return { label: 'Closed', icon: 'close-circle-outline', color: Colors.textMuted };
  }
  return goal.isUnlocked
    ? { label: 'Ready to collect', icon: 'lock-open-variant', color: Colors.success }
    : { label: 'Locked', icon: 'lock', color: Colors.textSecondary };
}

export default function GoalCard({ goal, onPress }: { goal: PersonalGoal; onPress: () => void }) {
  const status = statusFor(goal);
  const progress = goal.progressPercent ?? 0;
  const isActive = goal.status === 'active';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.header}>
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>{goal.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {goal.name}
          </Text>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons
              name={status.icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={13}
              color={status.color}
            />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        {isActive && goal.isUnlocked ? (
          <View style={styles.readyBadge}>
            <Text style={styles.readyText}>READY</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.currentAmount}>{formatCurrency(goal.currentAmount)}</Text>
        {goal.targetAmount ? (
          <Text style={styles.targetAmount}>of {formatCurrency(goal.targetAmount)}</Text>
        ) : null}
      </View>

      {goal.targetAmount ? (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progress, 100)}%`,
                  backgroundColor: progress >= 100 ? Colors.success : Colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      ) : null}

      {/* What's still outstanding — computed server-side so the card and the
          collect endpoint can never disagree about why a goal is locked. */}
      {isActive && !goal.isUnlocked && goal.lockedReasons.length > 0 ? (
        <View style={styles.lockRow}>
          {goal.lockedReasons.map((reason) => (
            <View key={reason} style={styles.lockItem}>
              <MaterialCommunityIcons name="circle-small" size={16} color={Colors.textMuted} />
              <Text style={styles.lockText}>{reason}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!goal.hasSavingsAccount && isActive ? (
        <View style={styles.warnRow}>
          <MaterialCommunityIcons name="alert-outline" size={14} color={Colors.warning} />
          <Text style={styles.warnText}>Add your MoMo number in Settings to start saving</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  name: { fontSize: 15.5, fontWeight: '800', color: Colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  readyBadge: {
    backgroundColor: Colors.successLight,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  readyText: { fontSize: 10, fontWeight: '800', color: Colors.success, letterSpacing: 0.5 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  currentAmount: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  targetAmount: { fontSize: 13, color: Colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  progressFill: { height: 7, borderRadius: 4 },
  progressText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, minWidth: 34, textAlign: 'right' },
  lockRow: { gap: 2 },
  lockItem: { flexDirection: 'row', alignItems: 'center' },
  lockText: { fontSize: 12.5, color: Colors.textSecondary },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnText: { flex: 1, fontSize: 11.5, color: Colors.warning },
});
