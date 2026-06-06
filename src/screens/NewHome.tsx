import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { HeaderBar } from '../ui';
import Card from '../components/Card';
import FAB from '../components/FAB';
import { formatMoney, localIsoDate } from '../utils/format';
import type { RecentBill, BillReminder, MarketStockSummary, PartyLedgerSummary, Language } from '../types';

export function HomeScreen({
  allBills,
  backupMessage,
  billReminders,
  goldRate,
  language,
  marketStockRows,
  onBackup,
  onBills,
  onClearBooks,
  onItemNames,
  onMarketStock,
  onNewBill,
  onParties,
  onRateEdit,
  onReminders,
  onSuppliers,
  onCashLedger,
  onBankLedger,
  partyLedgers,
  silverRate,
}: {
  allBills: RecentBill[];
  backupMessage: string;
  billReminders: BillReminder[];
  goldRate: string;
  language: Language;
  marketStockRows: MarketStockSummary[];
  onBackup: () => void;
  onBills: () => void;
  onClearBooks: () => void;
  onItemNames: () => void;
  onMarketStock: () => void;
  onNewBill: () => void;
  onParties: () => void;
  onRateEdit: () => void;
  onReminders: () => void;
  onSuppliers: () => void;
  onCashLedger: () => void;
  onBankLedger: () => void;
  partyLedgers: PartyLedgerSummary[];
  silverRate: string;
}) {
  const todayIso = localIsoDate();
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
  const dueReminders = billReminders.filter((r) => r.status === 'active');

  return (
    <View style={styles.root}>
      <HeaderBar title="Dashboard" onCreate={onNewBill} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryRow}>
          <Card style={styles.smallCard}>
            <Text style={styles.cardTitle}>Today's bills</Text>
            <Text style={styles.cardValue}>{todayBills.length}</Text>
            <Text style={styles.cardMeta}>{formatMoney(todayAmount)}</Text>
          </Card>
          <Card style={styles.smallCard}>
            <Text style={styles.cardTitle}>Monthly amount</Text>
            <Text style={styles.cardValue}>{formatMoney(monthAmount)}</Text>
            <Text style={styles.cardMeta}>{`${monthBills.length} bills`}</Text>
          </Card>
          <Card style={styles.smallCard}>
            <Text style={styles.cardTitle}>Fine due</Text>
            <Text style={styles.cardValue}>{formatMoney(fineDue)}</Text>
            <Text style={styles.cardMeta}>Labour: {formatMoney(labourDue)}</Text>
          </Card>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actionsGrid}>
            <Pressable style={styles.action} onPress={onNewBill}>
              <Text style={styles.actionText}>Create bill</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={onParties}>
              <Text style={styles.actionText}>Parties</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={onBills}>
              <Text style={styles.actionText}>Bills</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={onSuppliers}>
              <Text style={styles.actionText}>Suppliers</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={onCashLedger}>
              <Text style={styles.actionText}>Cash ledger</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={onBankLedger}>
              <Text style={styles.actionText}>Bank ledger</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={onRateEdit}>
              <Text style={styles.actionText}>Edit rates</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={onReminders}>
              <Text style={styles.actionText}>Reminders</Text>
            </Pressable>
          </View>
        </Card>

        <View style={{ height: 120 }} />
      </ScrollView>
      <FAB onPress={onNewBill} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8faf8' },
  content: { padding: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  smallCard: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 12, color: '#666' },
  cardValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#999', marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { width: '48%', paddingVertical: 12, marginBottom: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#fff' },
  actionText: { fontSize: 14, fontWeight: '600' },
});
