import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/constants/colors';

interface AvatarInitialsProps {
  name: string;
  size?: number;
}

const PALETTE = [Colors.primary, Colors.success, Colors.accent, Colors.warning, Colors.primaryDark];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function AvatarInitials({ name, size = 44 }: AvatarInitialsProps) {
  const initials = useMemo(() => initialsOf(name), [name]);
  const bg = useMemo(() => colorFor(name), [name]);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.white,
    fontWeight: '700',
  },
});
