import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AvatarInitials from '@/src/components/AvatarInitials';
import PenaltyBadge from '@/src/components/PenaltyBadge';
import ReliabilityBar from '@/src/components/ReliabilityBar';
import StatusChip from '@/src/components/StatusChip';
import { Colors } from '@/src/constants/colors';
import type { GroupMember } from '@/src/types';

interface MemberRowProps {
  member: GroupMember;
  onPress?: (member: GroupMember) => void;
}

export default function MemberRow({ member, onPress }: MemberRowProps) {
  return (
    <TouchableOpacity
      style={[styles.card, member.removed && styles.cardRemoved]}
      activeOpacity={0.7}
      onPress={() => onPress?.(member)}
    >
      {/* The whole row opens the member sheet; the avatar does too, with its
          own tap feedback, so tapping the face behaves as users expect. */}
      <AvatarInitials
        name={member.name}
        photoUrl={member.avatarUrl}
        size={44}
        onPress={onPress ? () => onPress(member) : undefined}
      />
      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, member.removed && styles.nameRemoved]} numberOfLines={1}>
            {member.name}
          </Text>
          {!member.removed ? <PenaltyBadge amount={member.penaltyDebt} /> : null}
        </View>
        {/* Mechanism 8 — reliability bar visible on every member row app-wide. */}
        <ReliabilityBar score={member.reliabilityScore} />
      </View>
      {member.removed ? (
        // Mechanism 10 — removed members keep a grey "Removed" chip instead of
        // a payment status; they are blocklisted from rejoining via the code.
        <View style={styles.removedChip}>
          <Text style={styles.removedLabel}>Removed</Text>
        </View>
      ) : (
        // Mechanism 5 — public late status: this chip renders for every member
        // of the group (the list is not admin-gated anywhere in the app).
        <StatusChip status={member.status} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardRemoved: {
    opacity: 0.55,
  },
  middle: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  nameRemoved: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  removedChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.divider,
  },
  removedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
});
