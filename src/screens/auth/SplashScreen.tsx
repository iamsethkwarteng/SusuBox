import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';

const ONBOARDING_SEEN_KEY = 'susutrack_onboarding_seen';

export default function SplashScreen() {
  const { isLoading, isAuthenticated } = useAuth();
  const progress = useRef(new Animated.Value(0)).current;
  const navigatedRef = useRef(false);

  useEffect(() => {
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
        router.replace('/(tabs)');
        return;
      }
      const seenOnboarding = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
      router.replace(seenOnboarding ? '/(auth)/login' : '/(auth)/onboarding');
    })();
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <MaterialCommunityIcons name="hand-coin" size={44} color={Colors.primary} />
      </View>
      <Text style={styles.title}>SusuTrack</Text>
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
