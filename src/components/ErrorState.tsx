import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/src/constants/colors';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

/**
 * Shared error state for every API-backed screen. When a fetch fails we show
 * this with a retry — we never fall back to sample data, because showing fake
 * groups/payments to a real user is worse than showing an honest error.
 */
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="wifi-alert" size={36} color={Colors.danger} />
      </View>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={onRetry}>
        <MaterialCommunityIcons name="refresh" size={18} color={Colors.white} />
        <Text style={styles.retryLabel}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 32, gap: 10 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  message: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
    minHeight: 48,
    minWidth: 180,
  },
  retryLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
