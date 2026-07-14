import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/constants/colors';

export default function IDVerifiedBadge() {
  return (
    <View style={styles.chip}>
      <MaterialCommunityIcons name="check-decagram" size={14} color={Colors.success} />
      <Text style={styles.label}>ID Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  label: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
});
