import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { formatCurrency } from '@/src/utils/formatCurrency';

interface PayoutDeductionCardProps {
  pot: number;
  arrears: number;
  penalty: number;
  estimated?: boolean;
  /**
   * Mechanism 3 — when provided, renders the admin's "I confirm this breakdown
   * is correct" checkbox inside the card. The parent gates its Confirm Payout
   * button on `confirmed`. Omitted for read-only member views.
   */
  confirmed?: boolean;
  onToggleConfirmed?: () => void;
}

// Anti-default enforcement: always show the full pot -> arrears -> penalty ->
// net breakdown before a payout is confirmed, so nobody is surprised by a
// smaller-than-expected payout.
export default function PayoutDeductionCard({
  pot,
  arrears,
  penalty,
  estimated = true,
  confirmed,
  onToggleConfirmed,
}: PayoutDeductionCardProps) {
  const net = useMemo(() => Math.max(0, pot - arrears - penalty), [pot, arrears, penalty]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Full pot</Text>
        <Text style={styles.rowValue}>{formatCurrency(pot)}</Text>
      </View>
      {arrears > 0 ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Arrears</Text>
          <Text style={[styles.rowValue, { color: Colors.danger }]}>- {formatCurrency(arrears)}</Text>
        </View>
      ) : null}
      {penalty > 0 ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Penalty</Text>
          <Text style={[styles.rowValue, { color: Colors.warning }]}>- {formatCurrency(penalty)}</Text>
        </View>
      ) : null}
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.netLabel}>Net payout</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.netValue}>{formatCurrency(net)}</Text>
          {estimated ? <Text style={styles.estimated}>Estimated</Text> : null}
        </View>
      </View>

      {onToggleConfirmed ? (
        <TouchableOpacity style={styles.confirmRow} onPress={onToggleConfirmed} activeOpacity={0.7}>
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
            {confirmed ? <MaterialCommunityIcons name="check" size={13} color={Colors.white} /> : null}
          </View>
          <Text style={styles.confirmLabel}>I confirm this breakdown is correct</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  netLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  netValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.success,
  },
  estimated: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  confirmLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
