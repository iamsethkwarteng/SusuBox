import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/src/constants/colors';
import { reliabilityColor } from '@/src/utils/reliabilityColor';

interface ReliabilityBarProps {
  score: number; // 0-100
  showLabel?: boolean;
  height?: number;
}

export default function ReliabilityBar({ score, showLabel = true, height = 6 }: ReliabilityBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = reliabilityColor(clamped);

  return (
    <View style={styles.row}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            { width: `${clamped}%`, backgroundColor: color, height, borderRadius: height / 2 },
          ]}
        />
      </View>
      {showLabel ? <Text style={[styles.label, { color }]}>{clamped}%</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
  },
  fill: {
    minWidth: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 34,
  },
});
