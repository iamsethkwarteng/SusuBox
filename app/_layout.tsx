import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaystackProvider } from 'react-native-paystack-webview';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OfflineBanner from '@/src/components/OfflineBanner';
import { ToastHost } from '@/src/components/Toast';
import { PAYSTACK_PUBLIC_KEY } from '@/src/constants/api';
import { Colors } from '@/src/constants/colors';
import { paperTheme } from '@/src/constants/paperTheme';
import { useSession } from '@/src/hooks/useSession';
import { initFCM } from '@/src/utils/initFCM';

export default function RootLayout() {
  // Update 6 — subscribes to the SESSION_CONFLICT event from the API client.
  const { sessionConflict, acknowledgeConflict } = useSession();

  useEffect(() => {
    initFCM();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <PaystackProvider publicKey={PAYSTACK_PUBLIC_KEY} currency="GHS">
            <View style={{ flex: 1 }}>
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="group/[id]/index" />
                <Stack.Screen name="group/[id]/rotation" />
                <Stack.Screen name="group/create" />
                <Stack.Screen name="group/created" />
                <Stack.Screen name="join-group" />
                <Stack.Screen name="join/[code]" />
                <Stack.Screen name="payment" options={{ presentation: 'modal' }} />
                <Stack.Screen name="notifications" />
              </Stack>

              {/* Update 6 — full-screen "signed out on another device" modal. */}
              <Modal visible={sessionConflict} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalCard}>
                    <MaterialCommunityIcons name="logout-variant" size={40} color={Colors.danger} />
                    <Text style={styles.modalTitle}>Signed out</Text>
                    <Text style={styles.modalBody}>
                      Your account was logged in on another device. You have been signed out.
                    </Text>
                    <TouchableOpacity style={styles.modalButton} onPress={acknowledgeConflict} activeOpacity={0.85}>
                      <Text style={styles.modalButtonLabel}>OK</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <ToastHost />
              <StatusBar style="dark" />
            </View>
          </PaystackProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(44,44,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  modalBody: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  modalButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  modalButtonLabel: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
