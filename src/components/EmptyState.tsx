import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';

interface EmptyStateProps {
  /** MaterialCommunityIcons glyph name. */
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

/**
 * Shared empty state for every API-backed screen. A screen with a real endpoint
 * must render this when the API returns an empty list — never sample data.
 */
export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={icon} size={40} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={onAction}>
          <Text style={styles.primaryLabel}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={onSecondaryAction}>
          <Text style={styles.secondaryLabel}>{secondaryActionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 32, gap: 8 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 16,
    minHeight: 48,
    justifyContent: 'center',
    minWidth: 200,
  },
  primaryLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 48,
    justifyContent: 'center',
    minWidth: 200,
  },
  secondaryLabel: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
});
