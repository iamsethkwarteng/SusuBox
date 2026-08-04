import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';

interface AvatarInitialsProps {
  name: string;
  /** Cloudinary profile photo; falls back to coloured initials when absent. */
  photoUrl?: string | null;
  size?: number;
  /** When provided the avatar becomes tappable (own avatar → Profile, another
   *  member's → their profile sheet). Omit for decorative avatars. */
  onPress?: () => void;
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

export default function AvatarInitials({ name, photoUrl, size = 44, onPress }: AvatarInitialsProps) {
  const initials = useMemo(() => initialsOf(name), [name]);
  const bg = useMemo(() => colorFor(name), [name]);

  const circle = { width: size, height: size, borderRadius: size / 2 };

  const inner = photoUrl ? (
    <Image source={{ uri: photoUrl }} style={[circle, { backgroundColor: Colors.divider }]} />
  ) : (
    <View style={[styles.circle, circle, { backgroundColor: bg }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );

  // Tappable only when a handler is supplied — a plain View otherwise, so
  // decorative avatars don't advertise an interaction that does nothing.
  if (!onPress) return inner;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      // hitSlop keeps small (32px) header avatars within a comfortable tap target.
      hitSlop={size < 48 ? 8 : 0}
      accessibilityRole="button"
      accessibilityLabel={`View ${name}'s profile`}
    >
      {inner}
    </TouchableOpacity>
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
