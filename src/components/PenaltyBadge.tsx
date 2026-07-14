import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { formatCurrency } from '@/src/utils/formatCurrency';

interface PenaltyBadgeProps {
  amount: number;
}

// Only renders when there's actually a debt — anti-default enforcement relies
// on this badge being visible to every member, not just admins.
export default function PenaltyBadge({ amount }: PenaltyBadgeProps) {
  if (!amount || amount <= 0) return null;

  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{formatCurrency(amount)} Debt</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  label: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
