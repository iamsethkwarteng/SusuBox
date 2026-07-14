import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';

// Rendered once near the navigation root so every screen benefits without
// each screen having to know about connectivity state.
export default function OfflineBanner() {
  const { isConnected } = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <MaterialCommunityIcons name="wifi-off" size={16} color={Colors.textSecondary} />
      <Text style={styles.text}>You&apos;re offline. Showing last saved data.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DEDCD4',
    paddingVertical: 8,
  },
  text: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
