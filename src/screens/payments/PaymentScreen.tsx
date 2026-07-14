import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePaystack } from 'react-native-paystack-webview';

import AvatarInitials from '@/src/components/AvatarInitials';
import { showToast } from '@/src/components/Toast';
import { Colors } from '@/src/constants/colors';
import { currentUser } from '@/src/constants/sampleData';
import { useGroup } from '@/src/hooks/useGroups';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { sendEmail } from '@/src/utils/sendEmail';

export default function PaymentScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroup(groupId);
  const { popup } = usePaystack();
  const [processing, setProcessing] = useState(false);

  if (!group) return null;

  const handlePay = () => {
    setProcessing(true);
    popup.checkout({
      email: currentUser.email,
      amount: group.contributionAmount,
      metadata: { groupId: group.id, cycle: group.cycle, userId: currentUser.id },
      onSuccess: (res) => {
        setProcessing(false);
        // Update 7 — after Paystack confirms, trigger the confirmation email
        // in addition to the in-app + FCM notifications. BACKEND REQUIRED:
        // the Paystack webhook is the source of truth; this client trigger is
        // a fast-path so the user sees the email promptly on success.
        sendEmail({
          type: 'contribution_confirmed',
          data: {
            name: currentUser.name,
            amount: group.contributionAmount,
            groupName: group.name,
            cycle: group.cycle,
            reference: res?.reference ?? 'N/A',
          },
        }).then(({ sent }) => {
          if (sent) showToast(`Confirmation email sent to ${currentUser.email}`);
        });
        Alert.alert('Payment successful', `Your contribution of ${formatCurrency(group.contributionAmount)} was confirmed.`, [
          { text: 'Done', onPress: () => router.back() },
        ]);
      },
      onCancel: () => setProcessing(false),
      onError: () => {
        setProcessing(false);
        Alert.alert('Payment failed', 'Something went wrong processing your payment. Please try again.');
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay contribution</Text>
        <AvatarInitials name={currentUser.name} size={32} />
      </View>

      <View style={styles.container}>
        <Text style={styles.amountLabel}>Total Contribution</Text>
        <Text style={styles.amountValue}>{formatCurrency(group.contributionAmount)}</Text>
        <Text style={styles.amountMeta}>{group.name} · Cycle {group.cycle}</Text>

        <View style={styles.secureNote}>
          <MaterialCommunityIcons name="lock-outline" size={18} color={Colors.primary} />
          <Text style={styles.secureText}>
            Payment confirmed automatically. Your funds are secured by encrypted bank-grade protocols and held
            in a regulated Susu trust account.
          </Text>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient Group</Text>
            <Text style={styles.detailValue}>{group.name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current Recipient</Text>
            <Text style={styles.detailValue}>{group.currentRecipientName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment channel</Text>
            <Text style={styles.detailValue}>Paystack — MoMo / Card</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.payButton} activeOpacity={0.85} onPress={handlePay} disabled={processing}>
          {processing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.payLabel}>Pay {formatCurrency(group.contributionAmount)}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.securedByRow}>
          <MaterialCommunityIcons name="lock-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.securedByText}>SECURED BY PAYSTACK</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  container: { flex: 1, alignItems: 'center', padding: 24, paddingTop: 40 },
  amountLabel: { fontSize: 13, color: Colors.textSecondary },
  amountValue: { fontSize: 40, fontWeight: '800', color: Colors.textPrimary, marginTop: 6 },
  amountMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  secureNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    marginTop: 32,
  },
  secureText: { flex: 1, fontSize: 12, color: Colors.primaryDark, lineHeight: 18 },
  detailCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginTop: 20,
    gap: 14,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: Colors.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  footer: { padding: 24, alignItems: 'center', gap: 10 },
  payButton: {
    width: '100%',
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  payLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  securedByRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  securedByText: { fontSize: 11, color: Colors.textMuted, letterSpacing: 0.5, fontWeight: '700' },
});
