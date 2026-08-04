import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTwoFAStatus } from '@/src/api/twoFA';
import { Colors } from '@/src/constants/colors';
import { patchAuthUser, useAuth } from '@/src/hooks/useAuth';

// Settings → Security. Shows the live two-step status and the actions that
// depend on it. Re-checks with the server on focus so returning from Setup or
// Disable always shows the truth rather than a stale cached flag.
export default function SecurityScreen() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(Boolean(user?.twoFaEnabled));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getTwoFAStatus()
        .then(({ enabled: on }) => {
          if (!active) return;
          setEnabled(on);
          patchAuthUser({ twoFaEnabled: on });
        })
        .catch(() => {
          // Offline — fall back to the cached flag rather than showing nothing.
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>TWO-STEP VERIFICATION</Text>

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>Two-step verification</Text>
              <Text style={styles.statusDesc}>
                {enabled
                  ? 'Your account is protected with a 6-digit PIN'
                  : 'Add an extra layer of security to your account'}
              </Text>
            </View>
            <View style={[styles.badge, enabled ? styles.badgeOn : styles.badgeOff]}>
              <Text style={[styles.badgeText, enabled ? styles.badgeTextOn : styles.badgeTextOff]}>
                {enabled ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>

          {!enabled ? (
            <TouchableOpacity
              style={styles.enableButton}
              activeOpacity={0.85}
              onPress={() => router.push('/settings/two-fa-setup')}
            >
              <MaterialCommunityIcons name="shield-plus-outline" size={18} color={Colors.white} />
              <Text style={styles.enableLabel}>Enable two-step verification</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.optionList}>
              <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/settings/change-pin')}>
                <MaterialCommunityIcons name="form-textbox-password" size={19} color={Colors.textSecondary} />
                <Text style={styles.optionText}>Change PIN</Text>
                <MaterialCommunityIcons name="chevron-right" size={19} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/settings/reset-pin')}>
                <MaterialCommunityIcons name="lock-reset" size={19} color={Colors.textSecondary} />
                <Text style={styles.optionText}>Forgot PIN — reset with password</Text>
                <MaterialCommunityIcons name="chevron-right" size={19} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionRow, styles.optionRowLast]}
                onPress={() => router.push('/settings/disable-2fa')}
              >
                <MaterialCommunityIcons name="shield-off-outline" size={19} color={Colors.danger} />
                <Text style={[styles.optionText, { color: Colors.danger }]}>
                  Disable two-step verification
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={19} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What is two-step verification?</Text>
          <Text style={styles.infoText}>
            It adds a second lock to your SusuBox account. With it on, you enter your 6-digit PIN every
            time you log in — so even if someone learns your password, they can&apos;t get in without the
            PIN. This protects your savings and your group&apos;s money.
          </Text>
          <Text style={styles.infoText}>
            After 3 wrong PIN attempts your account locks for 30 minutes. If you forget your PIN you can
            reset it with your account password.
          </Text>
        </View>
      </ScrollView>
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
  container: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statusDesc: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeOn: { backgroundColor: Colors.successLight },
  badgeOff: { backgroundColor: Colors.border },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  badgeTextOn: { color: Colors.success },
  badgeTextOff: { color: Colors.textSecondary },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
  },
  enableLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  optionList: { marginTop: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  optionRowLast: { borderBottomWidth: 0 },
  optionText: { flex: 1, fontSize: 14.5, color: Colors.textPrimary, fontWeight: '600' },
  infoBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 18,
    marginTop: 22,
    gap: 10,
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: Colors.primaryDark },
  infoText: { fontSize: 12.5, color: Colors.primaryDark, lineHeight: 19 },
});
