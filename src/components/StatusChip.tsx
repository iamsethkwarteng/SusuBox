import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StatusColors } from '@/src/constants/colors';
import type { ContributionStatus } from '@/src/types';

const LABELS: Record<ContributionStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  late: 'Late',
};

interface StatusChipProps {
  status: ContributionStatus;
}

export default function StatusChip({ status }: StatusChipProps) {
  const { fg, bg } = StatusColors[status];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
