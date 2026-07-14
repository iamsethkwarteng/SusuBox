import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import type { User } from '@/src/types';

interface VerificationStatusProps {
  user: User;
}

/**
 * Update 5 — three-state ID verification section:
 *   verified            → green badge + reassurance copy
 *   submitted, pending  → amber badge + "under review, ~24 hours"
 *   not submitted       → red badge + "Complete verification" CTA back to KYC
 */
export default function VerificationStatus({ user }: VerificationStatusProps) {
  if (user.idVerified) {
    return (
      <View style={[styles.card, { backgroundColor: Colors.successLight, borderColor: Colors.success }]}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="check-decagram" size={20} color={Colors.success} />
          <Text style={[styles.badgeLabel, { color: Colors.success }]}>ID Verified</Text>
        </View>
        <Text style={styles.body}>Your identity documents have been verified and approved.</Text>
      </View>
    );
  }

  if (user.idSubmitted) {
    return (
      <View style={[styles.card, { backgroundColor: Colors.warningLight, borderColor: Colors.warning }]}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="clock-outline" size={20} color={Colors.warning} />
          <Text style={[styles.badgeLabel, { color: Colors.warning }]}>Verification Pending</Text>
        </View>
        <Text style={styles.body}>Your documents are under review. This usually takes 24 hours.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: Colors.dangerLight, borderColor: Colors.danger }]}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="shield-alert-outline" size={20} color={Colors.danger} />
        <Text style={[styles.badgeLabel, { color: Colors.danger }]}>Not Verified</Text>
      </View>
      <Text style={styles.body}>Verify your identity to unlock payouts and build trust with your groups.</Text>
      <TouchableOpacity
        style={styles.cta}
        onPress={() => router.push('/(auth)/register')}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaLabel}>Complete verification</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 20,
    gap: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeLabel: { fontSize: 14, fontWeight: '800' },
  body: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 4,
  },
  ctaLabel: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
