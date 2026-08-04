import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AvatarInitials from '@/src/components/AvatarInitials';
import IDVerifiedBadge from '@/src/components/IDVerifiedBadge';
import PenaltyBadge from '@/src/components/PenaltyBadge';
import ReliabilityBar from '@/src/components/ReliabilityBar';
import StreakBadge, { earnedTiers } from '@/src/components/StreakBadge';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { isNetworkError } from '@/src/api/client';
import { removeMember } from '@/src/api/groups';
import { getCurrentAuthUser } from '@/src/hooks/useAuth';
import type { GroupMember } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { reliabilityLabel } from '@/src/utils/reliabilityColor';

// Labels the ID-number row by the document the member actually registered with.
const ID_TYPE_LABELS: Record<string, string> = {
  ghana_card: 'Ghana Card No.',
  voter_id: 'Voter ID No.',
  passport: 'Passport No.',
  drivers_licence: 'Licence No.',
};

interface MemberProfileSheetProps {
  member: GroupMember | null;
  onClose: () => void;
  isAdmin?: boolean;
  /** Needed for the admin Remove Member call (Mechanism 10). */
  groupId?: string;
  /** Parent updates its list so the removed row greys out immediately. */
  onRemoved?: (member: GroupMember) => void;
}

export default function MemberProfileSheet({
  member,
  onClose,
  isAdmin = true,
  groupId,
  onRemoved,
}: MemberProfileSheetProps) {
  const [removing, setRemoving] = useState(false);

  if (!member) return null;

  // Was previously compared against the sampleData demo user (fixed id 'u1'),
  // so isSelf was effectively always false for a real signed-in admin — the
  // "Remove Member" button would incorrectly show on the admin's own profile
  // (the backend does reject self-removal, but the button shouldn't appear).
  const authUser = getCurrentAuthUser();
  const streak = member.streak ?? (authUser && member.userId === authUser.id ? authUser.streak : 0);
  const badges = earnedTiers(streak);
  const isSelf = authUser != null && member.userId === authUser.id;

  const handleViewPenalty = () => {
    Alert.alert(
      'Penalty owed',
      `${member.name} owes ${formatCurrency(member.penaltyDebt)} in late-contribution penalties, deducted from their next payout.`,
    );
  };

  const handleVerifyIdentity = () => {
    Alert.alert('Verify identity', `Confirm that ${member.name}'s ID document and selfie match their profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark verified',
        onPress: () => Alert.alert('Identity verified', `${member.name} has been marked as verified.`),
      },
    ]);
  };

  // Mechanism 10 — remove + blocklist. Confirmation spells out the rejoin ban.
  const handleRemove = () => {
    Alert.alert(
      'Remove member',
      `Remove ${member.name} from this group? They will not be able to rejoin using the same invite code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              if (groupId) await removeMember(groupId, member.id);
            } catch (error) {
              // Never fake a removal — if the server didn't record it the member
              // is still in the group and the admin must be able to retry.
              setRemoving(false);
              showToast(
                isNetworkError(error)
                  ? 'Could not remove member — check your connection and try again'
                  : 'Could not remove member — try again',
              );
              return;
            }
            setRemoving(false);
            showToast(`${member.name} removed and blocklisted`);
            onRemoved?.(member);
          },
        },
      ],
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.avatarWrap}>
            <AvatarInitials name={member.name} size={88} />
          </View>
          <Text style={styles.name}>{member.name}</Text>
          {/* Was previously shown unconditionally for every member regardless
              of their real id_verified status — a false "verified" badge on an
              unverified member. Only render when the backend actually confirms it. */}
          {member.idVerified ? <IDVerifiedBadge /> : null}

          <View style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <Text style={styles.scoreLabel}>Reliability Score</Text>
              <Text style={styles.scoreValue}>{member.reliabilityScore}%</Text>
            </View>
            <ReliabilityBar score={member.reliabilityScore} showLabel={false} height={8} />
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="fire" size={20} color={Colors.accent} />
              <Text style={styles.statValue}>{streak} Cycles</Text>
              <Text style={styles.statSub}>In a row</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="shield-star" size={20} color={Colors.primary} />
              <Text style={styles.statValue}>{reliabilityLabel(member.reliabilityScore)}</Text>
              <Text style={styles.statSub}>Contributor</Text>
            </View>
          </View>

          {/* Mechanism 9 — earned streak badges. */}
          {badges.length > 0 ? (
            <View style={styles.badgeRow}>
              {badges.map((tier) => (
                <StreakBadge key={tier} tier={tier} />
              ))}
            </View>
          ) : null}

          {member.penaltyDebt > 0 ? (
            <TouchableOpacity style={styles.penaltyRow} activeOpacity={0.8} onPress={handleViewPenalty}>
              <MaterialCommunityIcons name="alert" size={18} color={Colors.danger} />
              <Text style={styles.penaltyText}>Penalty owed</Text>
              <View style={{ flex: 1 }} />
              <PenaltyBadge amount={member.penaltyDebt} />
              <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.danger} />
            </TouchableOpacity>
          ) : null}

          {isAdmin ? (
            <View style={styles.kycCard}>
              <Text style={styles.kycLabel}>KYC DOCUMENTS (ADMIN ONLY)</Text>
              <View style={styles.kycRow}>
                <View style={styles.kycThumb}>
                  <MaterialCommunityIcons name="card-account-details-outline" size={22} color={Colors.textMuted} />
                </View>
                <View style={styles.kycThumb}>
                  <MaterialCommunityIcons name="face-recognition" size={22} color={Colors.textMuted} />
                </View>
                <TouchableOpacity style={styles.kycVerifyButton} activeOpacity={0.8} onPress={handleVerifyIdentity}>
                  <MaterialCommunityIcons name="shield-check-outline" size={14} color={Colors.primary} />
                  <Text style={styles.kycVerifyLabel}>Verify Identity</Text>
                </TouchableOpacity>
              </View>

              {/* The number the member typed at registration. Cross-check it
                  against the card photo above before marking them verified —
                  a mismatch is the cheapest fraud signal available here. */}
              <View style={styles.idNumberRow}>
                <Text style={styles.idNumberLabel}>
                  {member.idType ? ID_TYPE_LABELS[member.idType] ?? 'ID Number' : 'ID Number'}
                </Text>
                <Text style={[styles.idNumberValue, !member.idNumber && styles.idNumberMissing]}>
                  {member.idNumber || 'Not provided'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Mechanism 10 — admins can remove anyone except themselves. */}
          {isAdmin && !isSelf ? (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemove}
              disabled={removing}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="account-remove-outline" size={17} color={Colors.danger} />
              <Text style={styles.removeLabel}>{removing ? 'Removing…' : 'Remove Member'}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeLabel}>Close</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(44,44,42,0.5)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  avatarWrap: { alignItems: 'center', marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
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
  kycCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  kycLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  kycRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  kycThumb: {
    width: 56,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycVerifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  kycVerifyLabel: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  idNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  idNumberLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  idNumberValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  idNumberMissing: { color: Colors.textMuted, fontWeight: '600', letterSpacing: 0 },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 16,
  },
  removeLabel: { color: Colors.danger, fontWeight: '700', fontSize: 14 },
  closeButton: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeLabel: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
