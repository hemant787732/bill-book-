import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

type BottomNavProps = {
  current: string;
  onNavigate: (screen: string) => void;
};

export function BottomNav({ current, onNavigate }: BottomNavProps) {
  return (
    <View style={styles.container}>
      <NavButton label="Home" active={current === 'home'} onPress={() => onNavigate('home')} />
      <NavButton label="Bills" active={current === 'bills'} onPress={() => onNavigate('bills')} />
      <NavButton label="Parties" active={current === 'parties'} onPress={() => onNavigate('parties')} />
      <NavButton label="Suppliers" active={current === 'suppliers'} onPress={() => onNavigate('suppliers')} />
    </View>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, active && styles.active, pressed && styles.pressed]}>
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

export function HeaderBar({ title, onCreate, onBack }: { title?: string; onCreate?: () => void; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
      <Text numberOfLines={1} style={styles.headerTitle}>{title ?? ''}</Text>
      {onCreate ? (
        <Pressable onPress={onCreate} style={styles.headerActionBtn}>
          <Text style={styles.headerAction}>＋</Text>
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e6e6e6',
    backgroundColor: '#ffffff',
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    color: '#222',
  },
  active: {
    backgroundColor: '#f4f9f5',
  },
  activeLabel: {
    fontWeight: '700',
    color: '#0a7',
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActionBtn: {
    padding: 8,
  },
  headerAction: {
    fontSize: 22,
    color: '#007aff',
  },
  backBtn: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: '#007aff',
  },
});
