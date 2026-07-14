import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { INVITE_WEB_BASE } from '@/src/constants/api';
import { currentUser } from '@/src/constants/sampleData';
import type { Group } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';

interface GroupCardProps {
  group: Group;
  onPress?: (group: Group) => void;
  width?: number;
  /** Hide the share row in compact placements (e.g. horizontal Home carousel). */
  compact?: boolean;
}

/**
 * Update 8 — Share Invite is available to ALL members, not just the admin:
 * susu circles grow through member word-of-mouth, so gating invites behind the
 * admin would choke organic growth. The message carries the sharer's name.
 * Uses React Native's built-in Share API (same native sheet react-native-share
 * opens; no extra native module needed, so it keeps working inside Expo Go).
 */
export async function shareGroupInvite(group: Group): Promise<void> {
  await Share.share({
    message: `${currentUser.name} invited you to join ${group.name} on SusuTrack! Code: ${group.inviteCode} Link: ${INVITE_WEB_BASE}/${group.inviteCode} Download SusuTrack to get started.`,
  }).catch(() => undefined);
}

export default function GroupCard({ group, onPress, width, compact = false }: GroupCardProps) {
  const paidCount = group.members.filter((m) => !m.removed && m.status === 'paid').length;
  const activeCount = group.members.filter((m) => !m.removed).length;

  return (
    <TouchableOpacity
      style={[styles.card, width ? { width } : null]}
      activeOpacity={0.75}
      onPress={() => onPress?.(group)}
    >
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
        <View style={[styles.roleBadge, group.role !== 'organizer' && styles.roleBadgeMember]}>
          <Text style={[styles.roleText, group.role !== 'organizer' && styles.roleTextMember]}>
            {group.role === 'organizer' ? 'Admin' : 'Member'}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {group.memberCount} members · {formatCurrency(group.contributionAmount)} / {group.frequency === 'weekly' ? 'week' : 'month'}
      </Text>

      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          {paidCount}/{activeCount} paid this cycle
        </Text>
        <Text style={styles.progressPct}>{group.progressPct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${group.progressPct}%` }]} />
      </View>

      {!compact ? (
        <TouchableOpacity style={styles.shareRow} onPress={() => shareGroupInvite(group)} hitSlop={8}>
          <MaterialCommunityIcons name="share-variant" size={14} color={Colors.primary} />
          <Text style={styles.shareLabel}>Share Invite</Text>
        </TouchableOpacity>
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
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  roleBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeMember: {
    backgroundColor: Colors.primaryLight,
  },
  roleText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  roleTextMember: {
    color: Colors.primary,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  shareLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
