import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import type { StreakTier } from '@/src/types';

// Mechanism 9 — streak badges. Thresholds:
//   3 consecutive on-time cycles  -> "Reliable Contributor"
//   5 consecutive on-time cycles  -> "Trusted Member"
//   a full rotation completed     -> "Susu Champion"
const TIERS: Record<StreakTier, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; fg: string; bg: string }> = {
  reliable: { label: 'Reliable Contributor', icon: 'fire', fg: Colors.accent, bg: Colors.accentLight },
  trusted: { label: 'Trusted Member', icon: 'shield-star', fg: Colors.primary, bg: Colors.primaryLight },
  champion: { label: 'Susu Champion', icon: 'trophy', fg: Colors.success, bg: Colors.successLight },
};

/** Returns every tier a member has earned given their streak and whether they
 *  completed a full rotation (streak >= totalCycles when known). */
export function earnedTiers(streak: number, completedFullRotation = false): StreakTier[] {
  const tiers: StreakTier[] = [];
  if (streak >= 3) tiers.push('reliable');
  if (streak >= 5) tiers.push('trusted');
  if (completedFullRotation) tiers.push('champion');
  return tiers;
}

interface StreakBadgeProps {
  tier: StreakTier;
  compact?: boolean;
}

export default function StreakBadge({ tier, compact = false }: StreakBadgeProps) {
  const meta = TIERS[tier];
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }, compact && styles.compact]}>
      <MaterialCommunityIcons name={meta.icon} size={compact ? 12 : 14} color={meta.fg} />
      <Text style={[styles.label, { color: meta.fg }, compact && styles.labelCompact]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelCompact: {
    fontSize: 10,
  },
});
