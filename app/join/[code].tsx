import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getToken } from '@/src/api/client';
import { Colors } from '@/src/constants/colors';
import { savePendingInvite } from '@/src/utils/pendingInvite';

// Update 8 — deep-link entry point for susubox://join/<code> and
// susubox.app/join/<code>. Joining requires an account:
//   • logged in  → straight to JoinGroupScreen with the code pre-filled
//   • logged out → park the code in secure store (survives app restarts) and
//                  send the user to Login, which shows "Log in to join …".
export default function JoinDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    (async () => {
      const normalized = (code ?? '').toUpperCase();
      await savePendingInvite({ code: normalized });
      const token = await getToken();
      if (token) {
        router.replace({ pathname: '/join-group', params: { code: normalized } });
      } else {
        router.replace('/(auth)/login');
      }
    })();
  }, [code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.primary} />
      <Text style={styles.text}>Opening invite…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.background },
  text: { fontSize: 14, color: Colors.textSecondary },
});
