import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type BottomNavProps = {
  current: string;
  onNavigate: (screen: string) => void;
};

export function BottomNav({ current, onNavigate }: BottomNavProps) {
  return (
    <View style={styles.container}>
      <NavButton 
        label="Home" 
        icon={current === 'home' ? "home" : "home-outline"} 
        active={current === 'home'} 
        onPress={() => onNavigate('home')} 
      />
      <NavButton 
        label="Bills" 
        icon={current === 'bills' ? "menu" : "menu-outline"} 
        active={current === 'bills'} 
        onNavigate={() => onNavigate('bills')} 
      />
      <NavButton 
        label="Parties" 
        icon={current === 'parties' ? "add-circle" : "add-circle-outline"} 
        active={current === 'parties'} 
        onNavigate={() => onNavigate('parties')} 
      />
      <NavButton 
        label="Suppliers" 
        icon={current === 'suppliers' ? "settings" : "settings-outline"} 
        active={current === 'suppliers'} 
        onNavigate={() => onNavigate('suppliers')} 
      />
    </View>
  );
}

function NavButton({ 
  label, 
  icon, 
  active, 
  onPress, 
  onNavigate 
}: { 
  label: string; 
  icon: any; 
  active: boolean; 
  onPress?: () => void;
  onNavigate?: () => void;
}) {
  const handlePress = onPress || onNavigate;
  return (
    <Pressable 
      onPress={handlePress} 
      style={({ pressed }) => [
        styles.button, 
        pressed && styles.pressed
      ]}
    >
      <Ionicons 
        name={icon} 
        size={22} 
        color={active ? '#007a66' : '#666'} 
      />
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
        <View style={{ width: 60 }} />
      )}
      <Text numberOfLines={1} style={styles.headerTitle}>{title ?? ''}</Text>
      {onCreate ? (
        <Pressable onPress={onCreate} style={styles.headerActionBtn}>
          <Ionicons name="add" size={28} color="#007a66" />
        </Pressable>
      ) : (
        <View style={{ width: 60 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  activeLabel: {
    fontWeight: '700',
    color: '#007a66',
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#263238',
    textAlign: 'center',
  },
  headerActionBtn: {
    width: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backBtn: {
    width: 60,
    justifyContent: 'center',
  },
  backText: {
    color: '#007a66',
    fontSize: 16,
    fontWeight: '600',
  },
});
