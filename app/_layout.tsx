import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaystackProvider } from 'react-native-paystack-webview';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { registerPushToken } from '@/src/api/notifications';
import OfflineBanner from '@/src/components/OfflineBanner';
import { ToastHost } from '@/src/components/Toast';
import { PAYSTACK_PUBLIC_KEY } from '@/src/constants/api';
import { Colors } from '@/src/constants/colors';
import { paperTheme } from '@/src/constants/paperTheme';
import { useSession } from '@/src/hooks/useSession';
import { initFCM, setupNotificationTapHandler } from '@/src/utils/initFCM';

export default function RootLayout() {
  // Update 6 — subscribes to the SESSION_CONFLICT event from the API client.
  const { sessionConflict, acknowledgeConflict } = useSession();

  useEffect(() => {
    // Fetch the push token and register it against the user, so server-side
    // sendFCM() has somewhere to push.
    //
    // In an APK/dev build this is a real FCM token, which is what the
    // backend's admin.messaging().send({ token }) expects — pushes deliver.
    // In Expo Go it falls back to an Expo push token, which that API cannot
    // send to; the token is still stored and the in-app bell works, because
    // sendFCM writes the Notification row before attempting any push.
    initFCM().then((token) => {
      if (token) registerPushToken(token).catch(() => {});
    });

    // Route a tapped notification to the group/goal it refers to. Registered
    // here rather than in a screen so it survives navigation and is active
    // when a killed app is launched by a notification.
    const unsubscribeTap = setupNotificationTapHandler();
    return unsubscribeTap;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* initialWindowMetrics matters specifically for the Paystack checkout.
          Without it, insets are measured asynchronously after first paint. A
          React Native <Modal> mounts and renders immediately, so the Paystack
          sheet's own SafeAreaView can compute ZERO top inset on its first
          frame and draw the WebView under the status bar — which is worse
          under Expo SDK 54, where android edgeToEdgeEnabled is true and the
          app deliberately draws behind the system bars.

          Seeding the provider with the metrics captured at native startup
          makes the correct inset available synchronously, on the very first
          render, including inside modals. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <PaperProvider theme={paperTheme}>
          {/* defaultChannels is REQUIRED here: the library defaults to
              ['card'] only, so without this the checkout sheet offers no
              mobile money option at all — unusable for a Ghanaian susu app
              where MoMo is how everyone pays. mobile_money is listed first so
              it is the option users land on.

              In v5 channels are a PROVIDER-level setting; PaystackParams has
              no `channels` field, so this cannot be passed per-checkout. */}
          <PaystackProvider
            publicKey={PAYSTACK_PUBLIC_KEY}
            currency="GHS"
            defaultChannels={['mobile_money', 'card', 'bank']}
            debug={__DEV__}
          >
            <View style={{ flex: 1 }}>
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="group/[id]/index" />
                <Stack.Screen name="group/[id]/rotation" />
                <Stack.Screen name="group/[id]/payout" />
                <Stack.Screen name="group/[id]/reports" />
                <Stack.Screen name="group/create" />
                <Stack.Screen name="group/created" />
                <Stack.Screen name="join-group" />
                <Stack.Screen name="join/[code]" />
                {/* A plain pushed screen, NOT presentation:'modal'.
                    PaystackProvider renders its checkout inside a React Native
                    <Modal>, and it sits above this Stack in the tree. When the
                    payment route was itself presented modally, Paystack was
                    asking to stack a modal on top of an already-presented one —
                    which silently never mounts, so the WebView's onLoadStart
                    never fired and the sheet simply didn't appear.

                    The personal-susu screens are plain pushed screens, which is
                    exactly why checkout worked there and not here. */}
                <Stack.Screen name="payment" />
                <Stack.Screen name="momo-setup" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="settings/security" />
                <Stack.Screen name="settings/two-fa-setup" />
                <Stack.Screen name="settings/change-pin" />
                <Stack.Screen name="settings/disable-2fa" />
                <Stack.Screen name="settings/reset-pin" />
                <Stack.Screen name="personal-susu/index" />
                <Stack.Screen name="personal-susu/create" />
                <Stack.Screen name="personal-susu/[id]" />
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
