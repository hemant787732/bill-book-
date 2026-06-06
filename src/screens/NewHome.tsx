import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { HeaderBar } from '../ui';
import Card from '../components/Card';
import FAB from '../components/FAB';
import { formatMoney, localIsoDate, formatDateForBill } from '../utils/format';
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
  // sort bills newest-first
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
  const dueReminders = billReminders.filter((r) => r.status === 'active');

  return (
    <View style={styles.root}>
      <HeaderBar title="Dashboard" onCreate={onNewBill} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>Quick dashboard</Text>
            <Text style={styles.heroSubtitle}>Create bills, check balances and access ledgers quickly.</Text>
          </View>
          <View style={styles.rateTiles}>
            <Pressable onPress={onRateEdit} style={styles.rateTile}>
              <Text style={styles.rateLabel}>Gold</Text>
              <Text style={styles.rateValue}>{formatMoney(goldRate)}</Text>
              <Text style={styles.rateMeta}>10 gm</Text>
            </Pressable>
            <Pressable onPress={onRateEdit} style={[styles.rateTile, styles.silverRateTile]}>
              <Text style={styles.rateLabel}>Silver</Text>
              <Text style={styles.rateValue}>{formatMoney(silverRate)}</Text>
              <Text style={styles.rateMeta}>1 kg</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Card style={styles.smallCard}>
            <Text style={styles.cardTitle}>Today's bills</Text>
            <Text style={styles.cardValue}>{todayBills.length}</Text>
            <Text style={styles.cardMeta}>{formatMoney(todayAmount)}</Text>
          </Card>

          <Card style={styles.smallCard}>
            <Text style={styles.cardTitle}>This month</Text>
            <Text style={styles.cardValue}>{formatMoney(monthAmount)}</Text>
            <Text style={styles.cardMeta}>{`${monthBills.length} bills`}</Text>
          </Card>

          <Card style={styles.smallCard}>
            <Text style={styles.cardTitle}>Due</Text>
            <Text style={styles.cardValue}>{formatMoney(fineDue)}</Text>
            <Text style={styles.cardMeta}>Labour: {formatMoney(labourDue)}</Text>
          </Card>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Recent bills</Text>
          {recent.length ? (
            recent.map((b) => (
              <Pressable key={b.id} onPress={onBills} style={styles.recentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentBillNo}>#{b.billNo} • {formatDateForBill(b.billDate)}</Text>
                  <Text style={styles.recentCustomer}>{b.customerName || 'Customer'}</Text>
                </View>
                <Text style={styles.recentAmount}>{formatMoney(b.netTotal)}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent bills</Text>
          )}
          <View style={styles.rowActions}>
            <Pressable onPress={onBills} style={[styles.viewAllButton]}>
              <Text style={styles.viewAllText}>View all bills</Text>
            </Pressable>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actionsGrid}>
            <Pressable style={styles.action} onPress={onNewBill}>
              <Text style={styles.actionText}>Create bill</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={onParties}>
              <Text style={styles.actionText}>Parties</Text>
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
            <Pressable style={styles.action} onPress={onBackup}>
              <Text style={styles.actionText}>Backup</Text>
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
  root: { flex: 1, backgroundColor: '#eef6f2' },
  content: { padding: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  heroInfo: { flex: 1, paddingRight: 8 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: '#004d40' },
  heroSubtitle: { fontSize: 12, color: '#666', marginTop: 4 },
  rateTiles: { flexDirection: 'row' },
  rateTile: { backgroundColor: '#fff', padding: 8, borderRadius: 8, width: 100, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e6f4ee' },
  silverRateTile: {},
  rateLabel: { fontSize: 12, color: '#666' },
  rateValue: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  rateMeta: { fontSize: 11, color: '#999', marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap' },
  smallCard: { flexBasis: '31%', marginRight: 6, minWidth: 100 },
  cardTitle: { fontSize: 12, color: '#666' },
  cardValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#777', marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  recentBillNo: { fontSize: 13, fontWeight: '600' },
  recentCustomer: { fontSize: 12, color: '#666' },
  recentAmount: { fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#888', paddingVertical: 8 },
  rowActions: { marginTop: 8, alignItems: 'flex-end' },
  viewAllButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#007a66', borderRadius: 6 },
  viewAllText: { color: '#fff', fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  action: { width: '48%', paddingVertical: 12, marginBottom: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#f4fbf9', borderWidth: 1, borderColor: '#e6f4ee' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#004d40' },
});
