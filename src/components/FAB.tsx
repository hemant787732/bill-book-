import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

export default function FAB({ onPress, label = '＋' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} style={styles.fab}>
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    backgroundColor: '#007a66',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 26,
    lineHeight: 26,
    fontWeight: '700',
  },
});
