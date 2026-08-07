const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Resolves the Android manifest merger conflict on the Firebase notification
 * colour.
 *
 * Two packages declare the same meta-data with different values:
 *   expo-notifications   -> @color/notification_icon_color  (our #185FA5 brand)
 *   @react-native-firebase/messaging
 *                        -> ${firebaseJsonNotificationColor}, default @color/white
 *
 * The merger refuses to pick one and fails the build with:
 *   Attribute meta-data#...default_notification_color@resource value=(...)
 *   is also present at [:react-native-firebase_messaging] value=(@color/white)
 *   Suggestion: add 'tools:replace="android:resource"'
 *
 * WHY A CONFIG PLUGIN AND NOT android/app/src/main/AndroidManifest.xml:
 * this is a managed Expo project — there is no android/ directory in the repo
 * (it is gitignored), and EAS Build runs `expo prebuild` which regenerates the
 * native project from scratch on every build. Anything hand-written there is
 * discarded before Gradle ever sees it. The manifest has to be patched during
 * prebuild, which is what this does.
 *
 * Runs AFTER the expo-notifications plugin (plugin order in app.json), so the
 * meta-data element it targets already exists.
 */
const withFirebaseNotificationColor = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    // tools:replace is meaningless without the tools namespace on <manifest>.
    manifest.manifest.$ = manifest.manifest.$ || {};
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application['meta-data'] = application['meta-data'] || [];

    const COLOR_KEY = 'com.google.firebase.messaging.default_notification_color';
    const existing = application['meta-data'].find(
      (item) => item.$ && item.$['android:name'] === COLOR_KEY,
    );

    if (existing) {
      // Keep our brand colour and tell the merger it wins over the library's.
      existing.$['tools:replace'] = 'android:resource';
    } else {
      // expo-notifications didn't emit it (e.g. `color` removed from its plugin
      // config) — declare it ourselves so the brand colour still applies.
      application['meta-data'].push({
        $: {
          'android:name': COLOR_KEY,
          'android:resource': '@color/notification_icon_color',
          'tools:replace': 'android:resource',
        },
      });
    }

    return cfg;
  });

module.exports = withFirebaseNotificationColor;
