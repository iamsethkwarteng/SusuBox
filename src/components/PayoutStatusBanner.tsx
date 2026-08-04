import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { formatCurrency } from '@/src/utils/formatCurrency';

export type PayoutBannerStatus = 'open' | 'closed' | 'paid_out' | 'blocked' | 'no_momo';

interface PayoutStatusBannerProps {
  status: PayoutBannerStatus;
  recipientName: string;
  netAmount: number;
  network?: string;
  /** Whether the viewer is the group admin (only they see the Send button). */
  isAdmin?: boolean;
  /** Reason shown for a blocked payout. */
  blockReason?: string;
  onSendPayout?: () => void;
}

// Renders the payout state for the current cycle. `open` renders nothing —
// contributions are still being collected.
export default function PayoutStatusBanner({
  status,
  recipientName,
  netAmount,
  network,
  isAdmin = false,
  blockReason,
  onSendPayout,
}: PayoutStatusBannerProps) {
  if (status === 'open') return null;

  if (status === 'paid_out') {
    return (
      <View style={[styles.banner, styles.greenBanner]}>
        <MaterialCommunityIcons name="check-circle" size={20} color={Colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: Colors.success }]}>Payout sent ✓</Text>
          <Text style={styles.body}>
            {formatCurrency(netAmount)} sent to {recipientName}
            {network ? `'s ${network} MoMo` : ''}
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'blocked') {
    return (
      <View style={[styles.banner, styles.redBanner]}>
        <MaterialCommunityIcons name="lock-alert-outline" size={20} color={Colors.danger} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: Colors.danger }]}>Payout blocked</Text>
          <Text style={styles.body}>{blockReason ?? `${recipientName} has unpaid contributions`}</Text>
        </View>
      </View>
    );
  }

  if (status === 'no_momo') {
    return (
      <View style={[styles.banner, styles.amberBanner]}>
        <MaterialCommunityIcons name="cellphone-off" size={20} color={Colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: Colors.warning }]}>MoMo number needed</Text>
          <Text style={styles.body}>
            {recipientName} needs to add their MoMo number before the payout can be sent.
          </Text>
        </View>
      </View>
    );
  }

  // status === 'closed' → ready to pay out.
  return (
    <View style={[styles.banner, styles.goldBanner, { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
      <View style={styles.rowHeader}>
        <MaterialCommunityIcons name="cash-fast" size={20} color={Colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: Colors.warning }]}>Ready to pay out</Text>
          <Text style={styles.body}>
            {formatCurrency(netAmount)} ready for {recipientName}
          </Text>
        </View>
      </View>
      {isAdmin ? (
        <TouchableOpacity style={styles.sendButton} activeOpacity={0.85} onPress={onSendPayout}>
          <MaterialCommunityIcons name="send" size={16} color={Colors.white} />
          <Text style={styles.sendLabel}>Send Payout</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greenBanner: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  redBanner: { backgroundColor: Colors.dangerLight, borderColor: Colors.danger },
  amberBanner: { backgroundColor: Colors.warningLight, borderColor: Colors.warning },
  goldBanner: { backgroundColor: Colors.warningLight, borderColor: Colors.warning },
  title: { fontSize: 14, fontWeight: '800' },
  body: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 13,
  },
  sendLabel: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});
