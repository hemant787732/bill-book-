import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Dimensions, Image } from 'react-native';
import { HeaderBar } from '../ui';
import Card from '../components/Card';
import FAB from '../components/FAB';
import { formatMoney, localIsoDate, formatDateForBill } from '../utils/format';
import { formatCalcValue } from '../utils/calculations';
import { SHOP } from '../config';
import type { RecentBill, PartyLedgerSummary, Language, MarketStockSummary, PurchaseStockRow } from '../types';

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
  onFlowLedger,
  onMarketStock,
  onStockLedger,
  onSettings,
  marketStockRows = [],
  partyLedgers,
  purchaseStockRows = [],
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
  onFlowLedger: () => void;
  onMarketStock?: () => void;
  onStockLedger?: () => void;
  onSettings?: () => void;
  marketStockRows?: MarketStockSummary[];
  partyLedgers: PartyLedgerSummary[];
  purchaseStockRows?: PurchaseStockRow[];
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
  const latestMarketStock = [...marketStockRows].sort((a, b) => b.runDate.localeCompare(a.runDate))[0];
  const purchaseFineIn = purchaseStockRows.reduce((sum, row) => sum + row.fineIn, 0);
  const purchaseFineSold = purchaseStockRows.reduce((sum, row) => sum + row.fineSold, 0);
  const purchaseFineOnHand = purchaseStockRows.reduce((sum, row) => sum + row.fineOnHand, 0);
  const purchasePcsOnHand = purchaseStockRows.reduce((sum, row) => sum + row.pcsOnHand, 0);
  const purchaseStockAlertCount = purchaseStockRows.filter((row) => row.fineOnHand < -0.0005 || row.pcsOnHand < 0).length;
  const openMarketStock = onMarketStock ?? onFlowLedger;
  const openStockLedger = onStockLedger ?? onSuppliers;

  const stockStatus = latestMarketStock
    ? latestMarketStock.closed
      ? Math.abs(latestMarketStock.silverVariance) > 0.001
        ? latestMarketStock.silverVariance > 0
          ? `Short ${formatCalcValue(latestMarketStock.silverVariance, 3)} gm`
          : `Extra ${formatCalcValue(Math.abs(latestMarketStock.silverVariance), 3)} gm`
        : 'Matched'
      : 'Open'
    : 'Not started';

  return (
    <View style={styles.root}>
      <HeaderBar title="Dashboard" onCreate={onNewBill} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* Teal Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Image source={require('../../assets/logo-mark.png')} style={styles.logoImg} resizeMode="contain" />
              </View>
              <View>
                <Text style={styles.shopName}>{SHOP.name}</Text>
                <Text style={styles.todayDate}>{formatDateForBill(todayIso)}</Text>
              </View>
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

        {/* Market stock reconciliation */}
        <Pressable onPress={openMarketStock} style={styles.stockCard}>
          <View style={styles.stockHeader}>
            <View>
              <Text style={styles.stockTitle}>Market stock reconciliation</Text>
              <Text style={styles.stockMeta}>
                {latestMarketStock ? `${formatDateForBill(latestMarketStock.runDate)} · ${stockStatus}` : 'Aaj ka maal leke nikle to yaha track hoga'}
              </Text>
            </View>
            <Text style={styles.stockOpenText}>Open</Text>
          </View>
          <View style={styles.stockGrid}>
            <View style={styles.stockMetric}>
              <Text style={styles.stockLabel}>Taken</Text>
              <Text style={styles.stockValue}>{latestMarketStock ? `${formatCalcValue(latestMarketStock.silverWeight, 3)} gm` : '0 gm'}</Text>
            </View>
            <View style={styles.stockMetric}>
              <Text style={styles.stockLabel}>Sold</Text>
              <Text style={styles.stockValue}>{latestMarketStock ? `${formatCalcValue(latestMarketStock.silverSold, 3)} gm` : '0 gm'}</Text>
            </View>
            <View style={styles.stockMetric}>
              <Text style={styles.stockLabel}>Should remain</Text>
              <Text style={styles.stockValue}>{latestMarketStock ? `${formatCalcValue(latestMarketStock.silverRemaining, 3)} gm` : '0 gm'}</Text>
            </View>
          </View>
          <Text style={styles.stockFoot}>Purchase stock in: {formatCalcValue(purchaseFineIn, 3) || '0'} gm fine</Text>
        </Pressable>

        {/* Purchase stock ledger */}
        <Pressable onPress={openStockLedger} style={[styles.stockCard, styles.ledgerStockCard]}>
          <View style={styles.stockHeader}>
            <View>
              <Text style={styles.stockTitle}>Stock ledger</Text>
              <Text style={styles.stockMeta}>
                Supplier purchase stock add/less live
              </Text>
            </View>
            <Text style={styles.stockOpenText}>Open</Text>
          </View>
          <View style={styles.stockGrid}>
            <View style={styles.stockMetric}>
              <Text style={styles.stockLabel}>Fine on hand</Text>
              <Text style={[styles.stockValue, purchaseFineOnHand < -0.0005 && styles.stockDangerText]}>
                {formatCalcValue(purchaseFineOnHand, 3) || '0'} gm
              </Text>
            </View>
            <View style={styles.stockMetric}>
              <Text style={styles.stockLabel}>Pcs on hand</Text>
              <Text style={[styles.stockValue, purchasePcsOnHand < 0 && styles.stockDangerText]}>{purchasePcsOnHand}</Text>
            </View>
            <View style={styles.stockMetric}>
              <Text style={styles.stockLabel}>Sold fine</Text>
              <Text style={styles.stockValue}>{formatCalcValue(purchaseFineSold, 3) || '0'} gm</Text>
            </View>
          </View>
          <Text style={[styles.stockFoot, purchaseStockAlertCount > 0 && styles.stockDangerText]}>
            Purchase fine in: {formatCalcValue(purchaseFineIn, 3) || '0'} gm{purchaseStockAlertCount ? ` · ${purchaseStockAlertCount} item negative` : ''}
          </Text>
        </Pressable>

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
          <Pressable style={styles.actionBtn} onPress={onFlowLedger}>
            <Text style={styles.actionBtnText}>Flow ledger</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={openMarketStock}>
            <Text style={styles.actionBtnText}>Market stock</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={openStockLedger}>
            <Text style={styles.actionBtnText}>Stock ledger</Text>
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
          {onSettings ? (
            <Pressable style={styles.actionBtn} onPress={onSettings}>
              <Text style={styles.actionBtnText}>Settings</Text>
            </Pressable>
          ) : null}
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
    borderRadius: 10, 
    padding: 10, 
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FDF6E9', alignItems: 'center', justifyContent: 'center' },
  logoImg: { width: 26, height: 26 },
  shopName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  todayDate: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  
  statsContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 6, 
    paddingVertical: 8 
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statValue: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 },
  statSub: { color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 1 },

  stockCard: {
    backgroundColor: '#fff',
    borderColor: '#d8e7e2',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  ledgerStockCard: {
    borderColor: '#ead8bd',
    backgroundColor: '#fffaf2',
  },
  stockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stockTitle: { color: '#263238', fontSize: 15, fontWeight: '800' },
  stockMeta: { color: '#718096', fontSize: 11, marginTop: 2 },
  stockOpenText: { color: '#007a66', fontSize: 12, fontWeight: '800' },
  stockGrid: { flexDirection: 'row', gap: 8 },
  stockMetric: {
    backgroundColor: '#f3fbf8',
    borderRadius: 8,
    flex: 1,
    padding: 8,
  },
  stockLabel: { color: '#718096', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  stockValue: { color: '#263238', fontSize: 12, fontWeight: '800', marginTop: 3 },
  stockFoot: { color: '#718096', fontSize: 11, fontWeight: '600', marginTop: 9 },
  stockDangerText: { color: '#b42318' },

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
