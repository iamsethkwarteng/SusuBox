import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// ESCALATION SCHEDULE (Mechanism 6 — for the backend developer)
// The backend fires push (FCM) + in-app notifications on this ladder for every
// member, every cycle. Timings are relative to the cycle's contribution due
// date and the group's grace_period_days:
//
//   Level 1  "Cycle open"        at cycle open (due − frequency period)
//            → type 'info'    "Cycle [N] of [Group] has started. GHS [amt] due [date]."
//   Level 2  "3-day reminder"    at due − 3 days (skip if already paid)
//            → type 'reminder' "Your GHS [amt] contribution to [Group] is due in 3 days."
//   Level 3  "1-day final warn"  at due − 1 day (skip if already paid)
//            → type 'warning' "Final warning: GHS [amt] due TOMORROW. GHS [fee] late fee applies."
//   Level 4  "Late alert"        at due + grace_period_days (skip if paid)
//            → type 'overdue' "Payment for [Group] is late. GHS [x] penalties added,
//                              reliability score reduced." Also notifies the group admin.
//
// Join-request notifications (Update 12):
//   • Admin FCM on new request:            "[Name] wants to join [Group]"
//   • Admin email if pending > 24h:        "[Name] is still waiting for approval in [Group]"
//   • Member FCM + email on approve:       "Welcome to [Group]! First contribution of GHS [amt] due [date]"
//   • Member FCM + email on decline:       "Your request to join [Group] was not approved"
// BACKEND REQUIRED: cron/queue that evaluates the ladder daily per open cycle.
// ---------------------------------------------------------------------------

// NOTE ON FCM: the spec calls for @react-native-firebase/messaging, but that
// package requires native config files (google-services.json /
// GoogleService-Info.plist) plus an EAS development build — it cannot run
// inside Expo Go and would crash `expo start` with no backend/Firebase
// project to point at yet. This module implements the same
// request-permission / get-token / foreground-listener contract using
// expo-notifications, which works today in Expo Go. When the Firebase
// project exists, swap the three function bodies below for the
// @react-native-firebase/messaging equivalents — every screen that imports
// this file keeps working unchanged.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestUserPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('[initFCM] Push notifications require a physical device.');
    return false;
  }
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[initFCM] Push permission denied.');
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  return true;
}

export async function getPushToken(): Promise<string | null> {
  try {
    const granted = await requestUserPermission();
    if (!granted) return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (error) {
    console.log('[initFCM] Failed to get push token', error);
    return null;
  }
}

export function onForegroundMessage(
  callback: (notification: Notifications.Notification) => void,
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
}

export async function initFCM(): Promise<string | null> {
  const token = await getPushToken();
  if (token) {
    console.log('[initFCM] Push token ready:', token);
  }
  return token;
}
