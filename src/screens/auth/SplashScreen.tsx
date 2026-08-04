import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { API_ORIGIN } from '@/src/constants/api';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';

const ONBOARDING_SEEN_KEY = 'susubox_onboarding_seen';

// Free-tier hosts sleep after inactivity and need ~30-60s to wake. Pinging the
// health endpoint while the splash animation plays means the first real API
// call (getMe / login) hits an already-awake server instead of timing out.
// Fire-and-forget: a failed warm-up must never block or delay navigation.
async function warmUpServer(): Promise<void> {
  try {
    await axios.get(API_ORIGIN, { timeout: 60000 });
    console.log('[warmup] Server is ready');
  } catch {
    console.log('[warmup] Server warm-up failed — will retry on first API call');
  }
}

export default function SplashScreen() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const progress = useRef(new Animated.Value(0)).current;
  const navigatedRef = useRef(false);

  useEffect(() => {
    // Start waking the server the moment the splash appears.
    warmUpServer();
    Animated.timing(progress, {
      toValue: 1,
      duration: 1400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (isLoading || navigatedRef.current) return;

    navigatedRef.current = true;
    (async () => {
      if (isAuthenticated) {
        // Bootstrap's GET /auth/me carries email_verified. A user who closed the
        // app on the verification screen lands right back on it — the dashboard
        // would only 403 on every call anyway.
        if (user && user.emailVerified === false) {
          router.replace({
            pathname: '/(auth)/verify-email',
            params: { email: user.email, name: user.name },
          });
          return;
        }
        router.replace('/(tabs)');
        return;
      }
      const seenOnboarding = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
      router.replace(seenOnboarding ? '/(auth)/login' : '/(auth)/onboarding');
    })();
  }, [isLoading, isAuthenticated, user]);

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <MaterialCommunityIcons name="hand-coin" size={44} color={Colors.primary} />
      </View>
      <Text style={styles.title}>SusuBox</Text>
      <Text style={styles.subtitle}>Group savings, made transparent</Text>

      <View style={styles.footer}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
        <Text style={styles.footerText}>SECURE CONNECTION</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 64,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    width: '70%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.white,
  },
  footerText: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
  },
});
