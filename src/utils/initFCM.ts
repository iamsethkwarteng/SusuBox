import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
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

// ---------------------------------------------------------------------------
// TWO TRANSPORTS, ONE CONTRACT
//
// @react-native-firebase/messaging needs a native module, which only exists in
// a real build (EAS dev-client or APK). In Expo Go the import throws, so it is
// loaded through try/require and we fall back to expo-notifications.
//
// The require resolves at bundle time because the package IS installed — the
// try/catch is guarding the RUNTIME "native module missing" throw, not a
// missing package. (If the package were absent, Metro would fail the bundle at
// build time and no try/catch could save it.)
//
// Token shapes differ and the backend must handle whichever it gets:
//   APK build → real FCM token      → admin.messaging().send({ token })  ✅
//   Expo Go   → Expo push token     → needs expo-server-sdk, NOT FCM
// So pushes only actually deliver from the APK build. In Expo Go the token is
// still stored and in-app notifications (the bell) work regardless, because
// the backend writes the Notification row before attempting any push.
// ---------------------------------------------------------------------------
let firebaseMessaging: (() => any) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  firebaseMessaging = require('@react-native-firebase/messaging').default;
} catch {
  console.log('[initFCM] Firebase messaging unavailable (Expo Go) — using Expo push token.');
}

export const isFirebaseAvailable = () => firebaseMessaging !== null;

// How a notification behaves while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android requires a channel before anything can be shown. Split by purpose so
// a user can silence reminders without losing payment confirmations.
async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const common = {
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  };
  await Notifications.setNotificationChannelAsync('default', {
    name: 'SusuBox',
    importance: Notifications.AndroidImportance.MAX,
    lightColor: '#185FA5',
    ...common,
  });
  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Payments & payouts',
    importance: Notifications.AndroidImportance.MAX,
    lightColor: '#1D9E75',
    ...common,
  });
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Contribution reminders',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#185FA5',
    ...common,
  });
}

// Which Android channel a given backend notification type belongs to.
function channelFor(type?: string): string {
  if (type === 'contribution_confirmed' || type === 'payout_received' || type === 'payout_turn') {
    return 'payments';
  }
  if (type === 'payment_due' || type === 'late_warning' || type === 'payout_frozen') {
    return 'reminders';
  }
  return 'default';
}

export async function requestUserPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('[initFCM] Push notifications require a physical device.');
    return false;
  }

  if (firebaseMessaging) {
    try {
      // 1 = AUTHORIZED, 2 = PROVISIONAL. 0 = DENIED, -1 = NOT_DETERMINED.
      const authStatus = await firebaseMessaging().requestPermission();
      if (authStatus !== 1 && authStatus !== 2) {
        console.log('[initFCM] Firebase push permission denied.');
        return false;
      }
      await ensureAndroidChannels();
      return true;
    } catch (error) {
      console.log('[initFCM] Firebase permission error:', error);
      return false;
    }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[initFCM] Expo push permission denied.');
    return false;
  }
  await ensureAndroidChannels();
  return true;
}

export async function getPushToken(): Promise<string | null> {
  try {
    const granted = await requestUserPermission();
    if (!granted) return null;

    if (firebaseMessaging) {
      const token: string = await firebaseMessaging().getToken();
      console.log(`[initFCM] FCM token ready: ${token?.slice(0, 20)}…`);
      return token;
    }

    // projectId is only passed when configured — passing `undefined` explicitly
    // makes some SDK versions throw rather than fall back to app.json.
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    console.log(`[initFCM] Expo push token ready: ${token.data?.slice(0, 20)}…`);
    return token.data;
  } catch (error) {
    console.log('[initFCM] Failed to get push token:', error);
    return null;
  }
}

export function onForegroundMessage(
  callback: (notification: Notifications.Notification) => void,
): () => void {
  if (firebaseMessaging) {
    // FCM does not display anything itself while the app is foregrounded, so
    // re-emit the payload as a local notification to make it visible.
    return firebaseMessaging().onMessage(async (remoteMessage: any) => {
      const type = remoteMessage?.data?.type;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage?.notification?.title ?? 'SusuBox',
            body: remoteMessage?.notification?.body ?? '',
            data: remoteMessage?.data ?? {},
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: channelFor(type) } : {}),
          },
          trigger: null,
        });
      } catch (error) {
        console.log('[initFCM] Could not present foreground notification:', error);
      }
      // Hand the raw payload to the caller for in-app handling (badge counts…).
      callback({
        date: Date.now(),
        request: {
          identifier: remoteMessage?.messageId ?? '',
          content: {
            title: remoteMessage?.notification?.title ?? '',
            body: remoteMessage?.notification?.body ?? '',
            data: remoteMessage?.data ?? {},
            sound: null,
            badge: null,
            subtitle: null,
          },
          trigger: null,
        },
      } as unknown as Notifications.Notification);
    });
  }

  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
}

// Routes a tapped notification to the screen it refers to.
//
// Uses expo-router's imperative `router` — this app has no React Navigation
// container or navigationRef to pass around. Keyed off the payload's ids
// rather than its `type`, because the backend sends many types that all mean
// "open this group", and a new type should not silently stop navigating.
function navigateFromNotification(data: Record<string, unknown> | undefined): void {
  if (!data) return;
  const goalId = typeof data.goalId === 'string' ? data.goalId : undefined;
  const groupId = typeof data.groupId === 'string' ? data.groupId : undefined;
  const type = typeof data.type === 'string' ? data.type : undefined;

  try {
    if (goalId) {
      router.push(`/personal-susu/${goalId}`);
    } else if (groupId) {
      router.push(`/group/${groupId}`);
    } else if (type === 'badge_earned') {
      router.push('/(tabs)/profile');
    } else {
      router.push('/notifications');
    }
  } catch (error) {
    // Navigator not mounted yet (cold start races the router) — the
    // notification is still in the bell, so this is recoverable.
    console.log('[initFCM] Could not navigate from notification:', error);
  }
}

export function setupNotificationTapHandler(): () => void {
  if (firebaseMessaging) {
    // App was backgrounded, not killed.
    const unsubscribe = firebaseMessaging().onNotificationOpenedApp((remoteMessage: any) => {
      navigateFromNotification(remoteMessage?.data);
    });

    // App was killed and launched by the notification. Delayed so the router
    // has mounted before we push onto it.
    firebaseMessaging()
      .getInitialNotification()
      .then((remoteMessage: any) => {
        if (remoteMessage) {
          setTimeout(() => navigateFromNotification(remoteMessage?.data), 1000);
        }
      })
      .catch(() => undefined);

    return unsubscribe;
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromNotification(
      response.notification.request.content.data as Record<string, unknown> | undefined,
    );
  });
  return () => subscription.remove();
}

// Registered at MODULE scope, not inside a component: Firebase requires the
// background handler to be set before the app finishes bootstrapping, or
// messages that arrive while the app is killed are dropped.
if (firebaseMessaging) {
  try {
    firebaseMessaging().setBackgroundMessageHandler(async () => {
      // Android displays `notification` payloads itself while backgrounded.
      // Nothing to do here — the handler must merely exist.
    });
  } catch (error) {
    console.log('[initFCM] Could not register background handler:', error);
  }
}

export async function initFCM(): Promise<string | null> {
  try {
    const token = await getPushToken();
    if (token) {
      console.log(`[initFCM] ${firebaseMessaging ? 'FCM' : 'Expo'} token ready ✅`);
    }
    return token;
  } catch (error) {
    console.log('[initFCM] Initialisation failed:', error);
    return null;
  }
}
