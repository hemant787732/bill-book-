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
    bottom: 24,
    backgroundColor: '#0a7',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '600',
  },
});
