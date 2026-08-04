import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/src/constants/colors';

// Six masked slots showing only how many digits have been entered — never the
// digits themselves. Shared by every PIN screen (login, setup, change, reset)
// so they all behave and look identical.
export default function PINDots({ length, error = false }: { length: number; error?: boolean }) {
  return (
    <View style={styles.row}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const filled = length > i;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              filled ? styles.filled : styles.empty,
              error && (filled ? styles.filledError : styles.emptyError),
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9 },
  empty: { borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent' },
  filled: { backgroundColor: Colors.primary },
  emptyError: { borderColor: Colors.danger },
  filledError: { backgroundColor: Colors.danger },
});
