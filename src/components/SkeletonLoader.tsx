import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { Colors } from '@/src/constants/colors';

interface SkeletonLoaderProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonLoader({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonLoaderProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: Colors.divider, opacity },
        style,
      ]}
    />
  );
}

// Prebuilt skeleton shapes for common loading states, kept in this file so
// screens don't each hand-roll their own placeholder layout.
export function GroupCardSkeleton() {
  return (
    <View style={styles.groupCard}>
      <SkeletonLoader width="60%" height={18} />
      <SkeletonLoader width="40%" height={12} style={{ marginTop: 10 }} />
      <SkeletonLoader width="100%" height={6} style={{ marginTop: 14 }} />
    </View>
  );
}

export function MemberRowSkeleton() {
  return (
    <View style={styles.memberRow}>
      <SkeletonLoader width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLoader width="50%" height={14} />
        <SkeletonLoader width="80%" height={8} />
      </View>
      <SkeletonLoader width={56} height={24} borderRadius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
});

export default SkeletonLoader;
