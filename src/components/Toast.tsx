import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { Colors } from '@/src/constants/colors';

// Tiny imperative toast: screens call showToast('...') from anywhere and the
// single <ToastHost/> mounted in the root layout renders it. Avoids threading
// a context through every screen for what is fire-and-forget UI feedback.

type Listener = (message: string) => void;
let listener: Listener | null = null;

export function showToast(message: string): void {
  listener?.(message);
}

const TOAST_DURATION_MS = 2600;

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (msg) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(() =>
          setMessage(null),
        );
      }, TOAST_DURATION_MS);
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    maxWidth: '86%',
    backgroundColor: 'rgba(44, 44, 42, 0.94)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    elevation: 6,
    shadowColor: Colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 999,
  },
  text: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ToastHost;
