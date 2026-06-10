import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { HeaderBar } from '../ui';
import Card from '../components/Card';
import FAB from '../components/FAB';
import { formatMoney, localIsoDate, formatDateForBill } from '../utils/format';
import { formatCalcValue } from '../utils/calculations';
import { SHOP } from '../config';
import type { RecentBill, PartyLedgerSummary, Language } from '../types';

const { width } = Dimensions.get('window');

export function HomeScreen({
  allBills,
  language,
  onBackup,
  onBills,
  onItemNames,
  onNewBill,
  onParties,
  onJangadBook,
  onReminders,
  onSuppliers,
  onCashLedger,
  onBankLedger,
  partyLedgers,
}: {
  allBills: RecentBill[];
  language: Language;
  onBackup: () => void;
  onBills: () => void;
  onItemNames: () => void;
  onNewBill: () => void;
  onParties: () => void;
  onJangadBook: () => void;
  onReminders: () => void;
  onSuppliers: () => void;
  onCashLedger: () => void;
  onBankLedger: () => void;
  partyLedgers: PartyLedgerSummary[];
}) {
  const todayIso = localIsoDate();
  const sortedBills = [...allBills].sort((a, b) => `${b.billDate}-${b.billNo}`.localeCompare(`${a.billDate}-${a.billNo}`));
  const recent = sortedBills.slice(0, 5);

  const todayBills = allBills.filter((bill) => bill.billDate === todayIso);
  const todayAmount = todayBills.reduce((s, b) => s + b.netTotal, 0);
  
  const monthBills = allBills.filter((bill) => {
    const d = new Date(`${bill.billDate}T00:00:00`);
    const now = new Date(todayIso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthAmount = monthBills.reduce((s, b) => s + b.netTotal, 0);
  
  const fineDue = partyLedgers.reduce((sum, ledger) => sum + ledger.fineBalance, 0);
  const labourDue = partyLedgers.reduce((sum, ledger) => sum + ledger.labourBalance, 0);

  return (
    <View style={styles.root}>
      <HeaderBar title="Dashboard" onCreate={onNewBill} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Teal Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.shopName}>{SHOP.name}</Text>
              <Text style={styles.todayDate}>{formatDateForBill(todayIso)}</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{todayBills.length}</Text>
              <Text style={styles.statLabel}>Today</Text>
              <Text style={styles.statSub}>₹ {formatMoney(todayAmount)}</Text>
            </View>
            <View style={[styles.statItem, styles.statDivider]}>
              <Text style={styles.statValue}>₹ {formatMoney(monthAmount)}</Text>
              <Text style={styles.statLabel}>This month</Text>
              <Text style={styles.statSub}>{monthBills.length} bills</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹ {formatMoney(labourDue)}</Text>
              <Text style={styles.statLabel}>Due</Text>
              <Text style={styles.statSub}>Fine {formatCalcValue(fineDue, 3)} gm</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionHeading}>Quick actions</Text>
        <View style={styles.actionsGrid}>
          <Pressable style={styles.actionBtn} onPress={onNewBill}>
            <Text style={styles.actionBtnText}>Create bill</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onParties}>
            <Text style={styles.actionBtnText}>Parties</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onSuppliers}>
            <Text style={styles.actionBtnText}>Suppliers</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onCashLedger}>
            <Text style={styles.actionBtnText}>Cash ledger</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onBankLedger}>
            <Text style={styles.actionBtnText}>Bank ledger</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onJangadBook}>
            <Text style={styles.actionBtnText}>Jangad book</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onReminders}>
            <Text style={styles.actionBtnText}>Reminders</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onBackup}>
            <Text style={styles.actionBtnText}>Backup</Text>
          </Pressable>
        </View>

        {/* Recent Bills */}
        <Text style={styles.sectionHeading}>Recent bills</Text>
        <Card style={styles.recentCard}>
          {recent.length ? (
            recent.map((b) => (
              <Pressable key={b.id} onPress={onBills} style={styles.recentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentBillNo}>#{b.billNo} • {formatDateForBill(b.billDate)}</Text>
                  <Text style={styles.recentCustomer}>{b.customerName || 'Customer'}</Text>
                </View>
                <Text style={styles.recentAmount}>₹ {formatMoney(b.netTotal)}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent bills found.</Text>
          )}
          <View style={styles.viewAllWrap}>
            <Pressable onPress={onBills} style={styles.viewAllBtn}>
              <Text style={styles.viewAllBtnText}>View all bills</Text>
            </Pressable>
          </View>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
      <FAB onPress={onNewBill} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 12 },
  
  heroCard: { 
    backgroundColor: '#007a66', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  shopName: { color: '#fff', fontSize: 22, fontWeight: '700' },
  todayDate: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  
  statsContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 8, 
    paddingVertical: 12 
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  statSub: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },

  sectionHeading: { fontSize: 16, fontWeight: '700', color: '#263238', marginBottom: 12, marginTop: 8 },
  
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  actionBtn: { 
    width: '48.5%', 
    backgroundColor: '#fff', 
    paddingVertical: 14, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#edf2f7'
  },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#4a5568' },

  recentCard: { padding: 0, overflow: 'hidden' },
  recentRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  recentBillNo: { fontSize: 13, fontWeight: '600', color: '#2d3748' },
  recentCustomer: { fontSize: 12, color: '#718096', marginTop: 2 },
  recentAmount: { fontSize: 14, fontWeight: '700', color: '#2d3748' },
  
  viewAllWrap: { padding: 10, alignItems: 'center' },
  viewAllBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  viewAllBtnText: { color: '#007a66', fontWeight: '700', fontSize: 14 },
  
  emptyText: { padding: 20, textAlign: 'center', color: '#a0aec0' },
});
