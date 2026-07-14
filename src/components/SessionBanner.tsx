import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { getSessionStartedAt } from '@/src/api/client';

const FRESH_SESSION_WINDOW_MS = 5 * 60 * 1000; // session younger than 5 min
const AUTO_DISMISS_MS = 5 * 1000;

/**
 * Update 6 — shows "New login detected on this device" at the top of Home when
 * the current session started less than 5 minutes ago, then auto-dismisses
 * after 5 seconds. Gives the user a visible cue that logging in here may have
 * kicked another device off (single-session enforcement).
 */
export default function SessionBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const startedAt = await getSessionStartedAt();
      if (startedAt && Date.now() - startedAt < FRESH_SESSION_WINDOW_MS) {
        setVisible(true);
        dismissTimer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
      }
    })();
    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <MaterialCommunityIcons name="cellphone-check" size={15} color={Colors.primaryDark} />
      <Text style={styles.text}>New login detected on this device</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  text: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
  },
});
