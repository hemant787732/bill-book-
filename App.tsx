import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { buildBillHtml } from './src/billHtml';
import { HomeScreen as NewHomeScreen } from './src/screens/NewHome';
import { SHOP } from './src/config';
import { DatabaseProvider, useDatabase } from './src/data/dbContext';
import {
  createBillTransaction,
  createCashBankEntry,
  createItemName,
  createBill,
  createPartyTransaction,
  createSupplierTransaction,
  extendBillReminder,
  getAllBills,
  getAllBillTransactions,
  getAllCashBankEntries,
  getAllPartyTransactions,
  getAllSupplierTransactions,
  getBackupData,
  getBillPayload,
  getBillReminderForBill,
  getBillReminders,
  getBillTransactions,
  getItemNames,
  getLatestRate,
  getMarketStockSummaries,
  getNextBillNo,
  getPartyFolders,
  getPartyLedgerSummaries,
  getPartyLedgerSummaryAtDate,
  getPartyTransactions,
  getSupplierAccounts,
  getSupplierLedgerSummaries,
  getSupplierTransactions,
  repairMirroredDiscountRows,
  getRecentBills,
  markBillEntered,
  markBillReminderDone,
  restoreBackupData,
  saveCustomer,
  setBillReminderNotificationId,
  updateBill,
  upsertBillReminder,
  upsertMarketRun,
  upsertRate,
} from './src/data/database';
import { restoreFromSupabaseBackup, syncPendingChanges } from './src/data/sync';
import { languageNames, t, translateNameOrItem } from './src/i18n';
import {
  AddSupplierScreen as SupplierAddScreen,
  SupplierDetailScreen as SupplierLedgerScreen,
  SupplierListScreen,
  SupplierTransactScreen as SupplierEntryScreen,
  type SupplierDraft,
} from './src/suppliers/supplier';
import { saveSupplierManualEntry } from './src/suppliers/supplier-sql';
import type {
  BillItemDraft,
  BillPayload,
  BillReminder,
  BillTransaction,
  BillTransactionMode,
  BillType,
  CashBankEntry,
  CustomerDraft,
  ItemNameOption,
  Language,
  LedgerMode,
  LabourType,
  MarketStockSummary,
  MetalType,
  OfficeEntryStatus,
  PartyFolder,
  PartyLedgerSummary,
  PartyTransaction,
  PartyTransactionMode,
  Rate,
  ReceiptType,
  RecentBill,
  SupplierAccount,
  SupplierLedgerSummary,
  SupplierTransaction,
  SupplierTransactionMode,
} from './src/types';
import {
  autoCalculateItem,
  calculateLabourCharge,
  calculateNetTotal,
  calculateReceivedFine,
  calculateTotalFine,
  formatCalcValue,
  getMetalRatePerGram,
  getMetalRateUnit,
  roundFineToHalfGram,
  type MetalRates,
} from './src/utils/calculations';
import { createId, formatDateForBill, formatMoney, formatPlainNumber, localIsoDate, parseAmount } from './src/utils/format';
import { BottomNav } from './src/ui';

type Screen =
  | 'home'
  | 'bill'
  | 'billView'
  | 'rates'
  | 'parties'
  | 'addParty'
  | 'partyBills'
  | 'partyTransact'
  | 'suppliers'
  | 'addSupplier'
  | 'supplierTransact'
  | 'cashLedger'
  | 'bankLedger'
  | 'bills'
  | 'clearBooks'
  | 'backup'
  | 'itemNames'
  | 'reminders'
  | 'marketStock';
type BillPeriod = 'today' | 'week' | 'month' | 'custom';
type LedgerPeriod = BillPeriod | 'year';
type WebPdfShareTarget = 'customer' | 'other';
type BillTransactionFormInput = {
  bankAmount: string;
  bookedRate: number;
  cashAmount: string;
  fineWeight: string;
  mode: BillTransactionMode;
  note: string;
  rateCutAmount: string;
  rateCutFine: string;
  transactionDate: string;
};
type PartyTransactionFormInput = {
  bankAmount: string;
  bookedRate: string;
  cashAmount: string;
  discountAmount: string;
  fineWeight: string;
  material: MetalType;
  mode: PartyTransactionMode;
  note: string;
  paymentAmount: string;
  transactionDate: string;
};
type SupplierTransactionFormInput = {
  bankAmount: string;
  bookedRate: string;
  cashAmount: string;
  discountAmount: string;
  fineWeight: string;
  material: MetalType;
  mode: SupplierTransactionMode;
  note: string;
  transactionDate: string;
};
type WebPdfShareFile = {
  file: File;
  fileName: string;
  html: string;
  payload: BillPayload;
  target: WebPdfShareTarget;
  title: string;
};
type WebNavigatorShareData = { files?: File[]; text?: string; title?: string };
type WebNavigatorShare = Navigator & {
  canShare?: (data: WebNavigatorShareData) => boolean;
  share?: (data: WebNavigatorShareData) => Promise<void>;
};
type ExpoFsFile = {
  copy(destination: ExpoFsFile): void;
  delete(): void;
  exists: boolean;
  name: string;
  text(): Promise<string>;
  textSync(): string;
  uri: string;
  write(content: string | Uint8Array, options?: unknown): void;
};
type ExpoFsDirectory = {
  create(options?: { idempotent?: boolean; intermediates?: boolean; overwrite?: boolean }): void;
  exists: boolean;
  list(): (ExpoFsFile | ExpoFsDirectory)[];
  name: string;
  uri: string;
};

const BACKUP_FOLDER_NAME = 'BillBookBackups';
const BACKUP_STORAGE_PREFIX = `backup/${BACKUP_FOLDER_NAME}/`;
const LEGACY_BACKUP_STORAGE_PREFIX = 'backup/';

function clientSyncMessage(ok: boolean) {
  return ok ? 'Data updated online.' : 'Data saved on this device. Internet update pending.';
}

function backupCountLine(result: { billItems: number; bills: number; customers: number; itemNames?: number; rates: number }) {
  const extras = [
    'billReminders' in result ? `${(result as { billReminders?: number }).billReminders ?? 0} reminders` : '',
    'billTransactions' in result ? `${(result as { billTransactions?: number }).billTransactions ?? 0} transactions` : '',
    'partyTransactions' in result ? `${(result as { partyTransactions?: number }).partyTransactions ?? 0} party vouchers` : '',
    'marketRuns' in result ? `${(result as { marketRuns?: number }).marketRuns ?? 0} market runs` : '',
    'cashBankEntries' in result ? `${(result as { cashBankEntries?: number }).cashBankEntries ?? 0} cash/bank entries` : '',
  ].filter(Boolean);
  return `${result.bills} bills, ${result.customers} parties, ${result.itemNames ?? 0} item names, ${result.rates} rates${
    extras.length ? `, ${extras.join(', ')}` : ''
  } restored.`;
}

function backupFileNameForToday() {
  return `${localIsoDate()}-backup.json`;
}

function getNativeBackupFolder() {
  const ExpoDirectory = FileSystem.Directory as unknown as new (...uris: unknown[]) => ExpoFsDirectory;
  const folder = new ExpoDirectory(FileSystem.Paths.document, BACKUP_FOLDER_NAME);
  if (!folder.exists) {
    folder.create({ idempotent: true, intermediates: true });
  }
  return folder;
}

function isExpoBackupFile(entry: ExpoFsFile | ExpoFsDirectory): entry is ExpoFsFile {
  return 'text' in entry && entry.name.endsWith('.json');
}

async function writeBackupToAppFolder(fileName: string, json: string) {
  await AsyncStorage.setItem(`${BACKUP_STORAGE_PREFIX}${fileName}`, json);

  if (Platform.OS === 'web') {
    return `${BACKUP_FOLDER_NAME}/${fileName}`;
  }

  const ExpoFile = FileSystem.File as unknown as new (...uris: unknown[]) => ExpoFsFile;
  const folder = getNativeBackupFolder();
  const targetFile = new ExpoFile(folder, fileName);
  if (targetFile.exists) {
    targetFile.delete();
  }
  targetFile.write(json);
  return targetFile.uri;
}

async function readLatestBackupFromAppFolder() {
  if (Platform.OS !== 'web') {
    try {
      const folder = getNativeBackupFolder();
      const latestFile = folder
        .list()
        .filter(isExpoBackupFile)
        .sort((a, b) => a.name.localeCompare(b.name))
        .at(-1);

      if (latestFile) {
        return { fileName: latestFile.name, json: await latestFile.text() };
      }
    } catch {
      // AsyncStorage fallback below keeps restore working even if the file folder is unavailable.
    }
  }

  const keys = await AsyncStorage.getAllKeys();
  const backupKeys = keys
    .filter((key) => key.startsWith(BACKUP_STORAGE_PREFIX) || (key.startsWith(LEGACY_BACKUP_STORAGE_PREFIX) && key.endsWith('.json')))
    .sort();
  const latestKey = backupKeys[backupKeys.length - 1];
  if (!latestKey) {
    return null;
  }

  const json = await AsyncStorage.getItem(latestKey);
  return json ? { fileName: latestKey.split('/').pop() ?? latestKey, json } : null;
}

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

function roundRupeeForDisplay(value: string | number | null | undefined) {
  return Math.trunc(parseAmount(value));
}

function formatBillMoney(value: string | number | null | undefined, autoRoundFigure = false) {
  return formatMoney(autoRoundFigure ? roundToTen(parseAmount(value)) : roundRupeeForDisplay(value));
}

function emptyItem(material: MetalType = 'gold'): BillItemDraft {
  return {
    amount: '',
    fine: '',
    id: createId('draft'),
    itemName: '',
    labour: '',
    labourType: 'gw',
    material,
    packetLess: '',
    pcs: '1',
    rate: '',
    touch: '',
    weight: '',
  };
}

function formatDateInput(value: string) {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const digits = trimmed.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits.length === 2 ? `${digits}/` : digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}${digits.length === 4 ? '/' : ''}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function dateInputToIso(value: string, fallback = localIsoDate()) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 8) {
    return fallback;
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
    return fallback;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseBillDate(value: string) {
  return new Date(`${dateInputToIso(value)}T00:00:00`);
}

function buildDueAtFromBillDate(billDateValue: string, days: string, time: string) {
  const dueDate = parseBillDate(billDateValue);
  dueDate.setDate(dueDate.getDate() + Math.max(Math.floor(parseAmount(days)), 1));
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  dueDate.setHours(Number.isFinite(hours) ? hours : 10, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return dueDate.toISOString();
}

function dueDateInputParts(billDateValue: string, dueAt: string) {
  const dueDate = new Date(dueAt);
  const billDateParsed = parseBillDate(billDateValue);
  const diffDays = Math.max(1, Math.ceil((dueDate.getTime() - billDateParsed.getTime()) / (24 * 60 * 60 * 1000)));
  const hours = String(dueDate.getHours()).padStart(2, '0');
  const minutes = String(dueDate.getMinutes()).padStart(2, '0');
  return { days: String(diffDays), time: `${hours}:${minutes}` };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${formatDateForBill(date.toISOString().slice(0, 10))} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function reminderIsDue(reminder: BillReminder) {
  return reminder.status === 'active' && new Date(reminder.dueAt).getTime() <= Date.now();
}

function gmText(value: number) {
  return `${formatPlainNumber(value)} gm`;
}

function kgTextFromGm(value: number) {
  const kg = value / 1000;
  return `${formatPlainNumber(kg)} kg`;
}

function isBillInPeriod(billDate: string, period: BillPeriod, customFrom: string, customTo: string) {
  const date = parseBillDate(billDate);
  const today = parseBillDate(localIsoDate());
  const billIso = dateInputToIso(billDate);

  if (period === 'today') {
    return billIso === localIsoDate();
  }

  if (period === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    return date >= weekStart && date <= today;
  }

  if (period === 'month') {
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }

  const from = customFrom.trim() ? parseBillDate(customFrom.trim()) : null;
  const to = customTo.trim() ? parseBillDate(customTo.trim()) : null;
  return (!from || date >= from) && (!to || date <= to);
}

function isLedgerInPeriod(entryDate: string, period: LedgerPeriod, customFrom: string, customTo: string) {
  if (period === 'year') {
    return parseBillDate(entryDate).getFullYear() === parseBillDate(localIsoDate()).getFullYear();
  }
  return isBillInPeriod(entryDate, period, customFrom, customTo);
}

function LedgerPeriodSelector({ period, onChange }: { period: LedgerPeriod; onChange: (value: LedgerPeriod) => void }) {
  return (
    <Segment
      options={[
        { label: 'Day', value: 'today' },
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
        { label: 'Year', value: 'year' },
        { label: 'Custom', value: 'custom' },
      ]}
      value={period}
      onChange={onChange}
      wrap
    />
  );
}

type CashBankLedgerEntry = {
  id: string;
  date: string;
  party: string;
  mode: LedgerMode;
  particular: string;
  receipt: number;
  payment: number;
};

function buildCashBankLedgerEntries(
  ledgerType: 'cash' | 'bank',
  allBills: RecentBill[],
  billTransactions: BillTransaction[],
  partyTransactions: PartyTransaction[],
  partyFolders: PartyFolder[],
  supplierTransactions: SupplierTransaction[],
  supplierAccounts: SupplierAccount[],
) {
  const entries: CashBankLedgerEntry[] = [];
  const billById = new Map(allBills.map((bill) => [bill.id, bill]));
  const partyNameById = new Map(partyFolders.map((party) => [party.customerId, party.customerName]));
  const supplierNameById = new Map(supplierAccounts.map((supplier) => [supplier.id, supplier.name]));

  for (const transaction of billTransactions) {
    const amount = ledgerType === 'cash' ? transaction.cashAmount : transaction.bankAmount;
    if (amount <= 0) {
      continue;
    }
    const bill = billById.get(transaction.billId);
    entries.push({
      date: transaction.transactionDate,
      id: transaction.id,
      mode: ledgerType,
      particular: `Bill #${bill?.billNo ?? ''} post-bill receipt`,
      party: bill?.customerName ?? 'Bill party',
      payment: 0,
      receipt: amount,
    });
  }

  for (const transaction of partyTransactions) {
    const amount = ledgerType === 'cash' ? transaction.cashAmount : transaction.bankAmount;
    if (amount > 0) {
      entries.push({
        date: transaction.transactionDate,
        id: `${transaction.id}-${ledgerType}`,
        mode: ledgerType,
        particular: `Voucher #${transaction.voucherNo} ${partyTransactionModeLabel(transaction.mode)}`,
        party: partyNameById.get(transaction.customerId) ?? 'Party account',
        payment: 0,
        receipt: amount,
      });
    }
    if (transaction.paymentAmount > 0 && ledgerType === 'cash') {
      entries.push({
        date: transaction.transactionDate,
        id: `${transaction.id}-payment`,
        mode: ledgerType,
        particular: `Voucher #${transaction.voucherNo} payment`,
        party: partyNameById.get(transaction.customerId) ?? 'Party account',
        payment: transaction.paymentAmount,
        receipt: 0,
      });
    }
  }

  for (const transaction of supplierTransactions) {
    const amount = ledgerType === 'cash' ? transaction.cashAmount : transaction.bankAmount;
    if (amount <= 0) {
      continue;
    }
    entries.push({
      date: transaction.transactionDate,
      id: `${transaction.id}-${ledgerType}`,
      mode: ledgerType,
      particular: `Supplier voucher #${transaction.voucherNo} payment`,
      party: supplierNameById.get(transaction.supplierId) ?? 'Supplier account',
      payment: amount,
      receipt: 0,
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function normalizeSearch(value: string | number | null | undefined) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function includesSearch(values: (string | number | null | undefined)[], query: string) {
  const needle = normalizeSearch(query);
  if (!needle) {
    return true;
  }

  return values.some((value) => normalizeSearch(value).includes(needle));
}

function partyMatchesSearch(folder: PartyFolder, query: string) {
  return includesSearch(
    [
      folder.customerName,
      folder.customerMobile,
      folder.customerAddress,
      folder.billCount,
      folder.totalAmount,
      formatDateForBill(folder.lastBillDate),
      folder.lastBillDate,
    ],
    query,
  );
}

function billMatchesSearch(bill: RecentBill, query: string) {
  return includesSearch(
    [
      bill.billNo,
      `#${bill.billNo}`,
      bill.customerName,
      bill.customerMobile,
      bill.customerAddress,
      bill.billDate,
      formatDateForBill(bill.billDate),
      bill.billType,
      bill.entryStatus === 'entered' ? 'clear' : 'pending',
      bill.netTotal,
      formatMoney(bill.netTotal),
    ],
    query,
  );
}

function ledgerFineLabel(ledger: PartyLedgerSummary) {
  return ledger.fineAdvance > 0 ? 'Fine advance' : 'Fine due';
}

function ledgerFineValue(ledger: PartyLedgerSummary) {
  const value = ledger.fineAdvance > 0 ? ledger.fineAdvance : ledger.fineBalance;
  return `${formatCalcValue(value, 3) || '0'} gm`;
}

function currentPartyFineOpening(folder: PartyFolder, ledger?: PartyLedgerSummary | null) {
  if (!ledger) {
    return folder.openingFineBalance;
  }
  if (ledger.fineAdvance > 0) {
    return -ledger.fineAdvance;
  }
  return ledger.fineBalance;
}

function currentPartyAmountOpening(folder: PartyFolder, ledger?: PartyLedgerSummary | null) {
  return ledger ? ledger.labourBalance : folder.openingLabourBalance;
}

function partyTransactionModeLabel(mode: PartyTransactionMode) {
  switch (mode) {
    case 'bank':
      return 'Bank receipt';
    case 'split':
      return 'Cash + bank receipt';
    case 'fine':
      return 'Metal receipt';
    case 'payment':
      return 'Payment given';
    case 'discount':
      return 'Discount';
    case 'cash':
    default:
      return 'Cash receipt';
  }
}

function partyTransactionCashTotal(transaction: PartyTransaction) {
  return transaction.cashAmount + transaction.bankAmount;
}

function partyTransactionDisplayAmount(transaction: PartyTransaction) {
  if (transaction.paymentAmount > 0) {
    return transaction.paymentAmount;
  }
  if (transaction.discountAmount > 0) {
    return transaction.discountAmount;
  }
  return partyTransactionCashTotal(transaction);
}

function partyTransactionMetalRateLabel(transaction: Pick<PartyTransaction, 'material'>) {
  return transaction.material === 'gold' ? 'Gold / 10 gm' : 'Silver / 1 kg';
}

function fineValueFromBookedRate(material: MetalType, fineWeight: string | number, bookedRate: string | number) {
  const fine = parseAmount(fineWeight);
  const rate = parseAmount(bookedRate);
  if (fine <= 0 || rate <= 0) {
    return 0;
  }
  return material === 'gold' ? (fine * rate) / 10 : (fine * rate) / 1000;
}

function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

function buildShareMessage(payload: BillPayload) {
  return `${SHOP.name} Bill #${payload.billNo}
Date: ${formatDateForBill(payload.billDate)}
Customer: ${payload.customer.name}
Amount: ${formatBillMoney(payload.netTotal, payload.autoRoundFigure)}
PDF: ${billDocumentName(payload)}.pdf`;
}

function billDocumentName(payload: BillPayload) {
  const party = payload.customer.name.trim() || 'Party';
  return `Bill ${payload.billNo} - ${party}`;
}

function safePdfFileName(payload: BillPayload) {
  const name = billDocumentName(payload)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${name || `Bill ${payload.billNo}`}.pdf`;
}

function voucherDocumentName(party: PartyFolder, transaction: PartyTransaction) {
  const partyName = party.customerName.trim() || 'Party';
  return `Voucher ${transaction.voucherNo} - ${partyName}`;
}

function safeVoucherFileName(party: PartyFolder, transaction: PartyTransaction) {
  const name = voucherDocumentName(party, transaction)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${name || `Voucher ${transaction.voucherNo}`}.pdf`;
}

function escapeHtmlText(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function voucherAmountRows(transaction: PartyTransaction) {
  const rows: { label: string; value: string }[] = [];
  if (transaction.cashAmount > 0) {
    rows.push({ label: 'Cash received', value: formatBillMoney(transaction.cashAmount) });
  }
  if (transaction.bankAmount > 0) {
    rows.push({ label: 'Bank received', value: formatBillMoney(transaction.bankAmount) });
  }
  if (transaction.paymentAmount > 0) {
    rows.push({ label: 'Payment given', value: formatBillMoney(transaction.paymentAmount) });
  }
  if (transaction.discountAmount > 0) {
    rows.push({ label: 'Discount allowed', value: formatBillMoney(transaction.discountAmount) });
  }
  if (transaction.fineWeight > 0) {
    rows.push({ label: 'Metal received', value: `${formatCalcValue(transaction.fineWeight, 3)} gm` });
    if (transaction.bookedRate > 0) {
      rows.push({
        label: 'Metal value',
        value: `${partyTransactionMetalRateLabel(transaction)} @ ${formatMoney(transaction.bookedRate)} = ${formatBillMoney(transaction.fineValue)}`,
      });
    }
  }
  return rows.length ? rows : [{ label: partyTransactionModeLabel(transaction.mode), value: formatBillMoney(partyTransactionDisplayAmount(transaction)) }];
}

function buildPartyVoucherHtml(party: PartyFolder, transaction: PartyTransaction, ledger?: PartyLedgerSummary | null) {
  const rows = voucherAmountRows(transaction)
    .map(
      (row) => `<tr>
        <td>${escapeHtmlText(row.label)}</td>
        <td>${escapeHtmlText(row.value)}</td>
      </tr>`,
    )
    .join('');

  const fineBalance = ledger ? ledgerFineValue(ledger) : '';
  const labourBalance = ledger ? formatMoney(ledger.labourBalance) : '';
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: auto; margin: 0; }
        * { box-sizing: border-box; }
        body {
          background: #fff;
          color: #211815;
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
        }
        .voucher {
          border: 1.4px solid #9b2339;
          margin: 0;
          display: inline-block;
          padding: 8px;
          width: auto;
        }
        .top {
          align-items: flex-start;
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }
        h1 {
          color: #9b2339;
          font-size: 18px;
          margin: 0 0 4px;
          text-transform: uppercase;
        }
        .shop {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .meta {
          color: #6d665f;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.45;
          text-align: right;
        }
        .party {
          border-bottom: 1px solid #b34654;
          border-top: 1px solid #b34654;
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr 1fr;
          margin: 16px 0;
          padding: 10px 0;
        }
        .label {
          color: #806f70;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .value {
          color: #211815;
          font-size: 13px;
          font-weight: 800;
          margin-top: 2px;
        }
        table {
          border-collapse: collapse;
          width: auto;
          min-width: 220px;
        }
        td, th {
          border: 1px solid #b34654;
          font-size: 12px;
          font-weight: 700;
          padding: 6px;
        }
        th {
          background: #f4e7df;
          color: #7a2030;
          text-align: left;
          text-transform: uppercase;
        }
        td:last-child {
          text-align: right;
        }
        .note {
          border: 1px solid #ead2d7;
          color: #5b1f2b;
          font-size: 12px;
          font-weight: 700;
          margin-top: 14px;
          min-height: 44px;
          padding: 10px;
        }
        .balance {
          background: #f8efe7;
          border: 1px solid #e0c3b9;
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr 1fr;
          margin-top: 14px;
          padding: 10px;
        }
        .signature {
          border-bottom: 1px solid #9b2339;
          font-size: 13px;
          font-weight: 800;
          margin-left: auto;
          margin-top: 36px;
          min-width: 180px;
          padding-bottom: 6px;
          text-align: left;
        }
      </style>
    </head>
    <body>
      <main class="voucher invoice">
        <section class="top">
          <div>
            <h1>Voucher</h1>
            <div class="shop">${escapeHtmlText(SHOP.name)}</div>
          </div>
          <div class="meta">
            Voucher No. : ${escapeHtmlText(transaction.voucherNo)}<br />
            Date : ${escapeHtmlText(formatDateForBill(transaction.transactionDate))}<br />
            Type : ${escapeHtmlText(partyTransactionModeLabel(transaction.mode))}
          </div>
        </section>
        <section class="party">
          <div>
            <div class="label">Party</div>
            <div class="value">${escapeHtmlText(party.customerName)}</div>
          </div>
          <div>
            <div class="label">Mobile</div>
            <div class="value">${escapeHtmlText(party.customerMobile || '-')}</div>
          </div>
          <div style="grid-column: 1 / -1;">
            <div class="label">Address</div>
            <div class="value">${escapeHtmlText(party.customerAddress || '-')}</div>
          </div>
        </section>
        <table>
          <thead>
            <tr>
              <th>Particulars</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <section class="balance">
          <div>
            <div class="label">Fine balance after entry</div>
            <div class="value">${escapeHtmlText(fineBalance || '-')}</div>
          </div>
          <div>
            <div class="label">Amount due after entry</div>
            <div class="value">${escapeHtmlText(labourBalance || '-')}</div>
          </div>
        </section>
        <div class="note"><b>Narration:</b> ${escapeHtmlText(transaction.note || partyTransactionModeLabel(transaction.mode))}</div>
        <div class="signature">Signature :</div>
      </main>
    </body>
  </html>`;
}

function receiptLines(payload: BillPayload) {
  const language = payload.language;
  const fineGiven = calculateTotalFine(payload.items);
  const fineReceived = receiptHasFine(payload.receiptType) ? parseAmount(payload.receivedFine) : 0;
  const fineBalance = fineGiven - fineReceived;
  const lines = [
    `${t(language, 'fineGiven')}: ${formatCalcValue(fineGiven, 3) || '0'} gm`,
    receiptHasFine(payload.receiptType)
      ? `${t(language, 'fineReceived')}: GW ${payload.receivedGrossWeight || '0'} x ${payload.receivedTouch || '0'}% = ${
          formatCalcValue(fineReceived, 3) || '0'
        } gm`
      : `${t(language, 'fineReceived')}: 0 gm`,
    fineBalance >= 0
      ? `${t(language, 'fineBalance')}: ${formatCalcValue(fineBalance, 3) || '0'} gm`
      : `${t(language, 'fineAdvance')}: ${formatCalcValue(Math.abs(fineBalance), 3) || '0'} gm`,
  ];

  if (receiptHasCash(payload.receiptType)) {
    return [...lines, `${t(language, 'cashReceived')}: ${formatBillMoney(payload.receivedCash, payload.autoRoundFigure)}`];
  }

  return lines;
}

function remainingBracketText(payload: BillPayload) {
  const summary = billTransactionSummary(payload);
  const fineLabel = summary.fineAdvance > 0 ? t(payload.language, 'fineAdvance') : t(payload.language, 'fineRemain');
  const fineValue = `${formatCalcValue(summary.fineAdvance > 0 ? summary.fineAdvance : summary.fineBalance, 3) || '0'} gm`;
  const labourValue = formatBillMoney(summary.labourBalance, payload.autoRoundFigure);
  return `[ ${fineLabel}: ${fineValue} | ${t(payload.language, 'labourRemain')}: ${labourValue} ]`;
}

function itemRateDisplayText(item: BillItemDraft) {
  const ratePerGram = parseAmount(item.rate);
  if (ratePerGram <= 0) {
    return '';
  }

  if (item.material === 'silver') {
    return formatMoney(ratePerGram * 1000);
  }

  return formatMoney(ratePerGram * 10);
}

function labourUnitLabel(type: LabourType | undefined) {
  return (type ?? 'gw') === 'pcs' ? 'pcs' : 'gw';
}

function itemLabourDisplay(item: BillItemDraft) {
  const labour = parseAmount(item.labour);
  if (labour <= 0) {
    return '';
  }

  return `${formatMoney(labour)}/${labourUnitLabel(item.labourType)}`;
}

function itemWeightDisplayText(item: BillItemDraft) {
  const weight = parseAmount(item.weight);
  const packetLess = parseAmount(item.packetLess);
  if (weight <= 0) {
    return '';
  }
  if (packetLess <= 0) {
    return formatPlainNumber(item.weight);
  }

  const netWeight = Math.max(weight - packetLess, 0);
  return formatCalcValue(netWeight, 3);
}

function rateSummaryLines(items: BillItemDraft[]) {
  const values = new Map<string, string>();
  for (const item of items) {
    if (!item.itemName.trim()) {
      continue;
    }
    const rateText = itemRateDisplayText(item);
    if (!rateText) {
      continue;
    }
    const label = item.material === 'silver' ? 'Silver / 1 kg' : 'Gold / 10 gm';
    values.set(`${item.material}-${rateText}`, `Booked rate - ${label}: ${rateText}`);
  }

  return [...values.values()];
}

function labourSummaryLine(items: BillItemDraft[], autoRoundFigure = false) {
  const total = items.reduce((sum, item) => sum + calculateLabourCharge(item), 0);
  return total > 0 ? `Labour: ${formatBillMoney(total, autoRoundFigure)}` : '';
}

function bookedRateInfoFromItems(items: BillItemDraft[]) {
  const item = items.find((entry) => entry.itemName.trim() && parseAmount(entry.rate) > 0);
  if (!item) {
    return {
      label: 'Booked rate',
      material: 'gold' as MetalType,
      ratePerGram: 0,
      unitRate: 0,
    };
  }

  const ratePerGram = parseAmount(item.rate);
  const unitRate = item.material === 'silver' ? ratePerGram * 1000 : ratePerGram * 10;
  return {
    label: item.material === 'silver' ? 'Silver / 1 kg' : 'Gold / 10 gm',
    material: item.material,
    ratePerGram,
    unitRate,
  };
}

function bookedRateInfoFromPayload(payload: BillPayload) {
  return bookedRateInfoFromItems(payload.items);
}

function bookedRateUnitCandidatesFromItems(items: BillItemDraft[]) {
  return items
    .map((item) => {
      const ratePerGram = parseAmount(item.rate);
      if (ratePerGram <= 0) {
        return 0;
      }
      return item.material === 'silver' ? ratePerGram * 1000 : ratePerGram * 10;
    })
    .filter((value) => value > 0);
}

function sanitizePayloadDiscountAmount(payload: BillPayload) {
  const discountValue = parseAmount(payload.discountAmount);
  const rateCutFine = parseAmount(payload.rateCutFine);
  if (discountValue <= 0 || rateCutFine <= 0) {
    return discountValue;
  }

  const rateCutAmount = parseAmount(payload.rateCutAmount);
  const bookedRateCandidates = [
    parseAmount(payload.rateCutBookedRate),
    bookedRateInfoFromPayload(payload).unitRate,
    ...bookedRateUnitCandidatesFromItems(payload.items),
  ].filter((value) => value > 0);
  const mirrorsRateCutAmount = rateCutAmount > 0 && Math.abs(discountValue - rateCutAmount) < 0.01;
  const mirrorsBookedRate = bookedRateCandidates.some((rate) => Math.abs(discountValue - rate) < 0.01);

  return mirrorsRateCutAmount || mirrorsBookedRate ? 0 : discountValue;
}

function billTransactionModeLabel(mode: BillTransactionMode) {
  switch (mode) {
    case 'bank':
      return 'Bank received';
    case 'split':
      return 'Cash + bank';
    case 'fine':
      return 'Fine received';
    case 'rate_cut':
      return 'Rate cut';
    case 'cash':
    default:
      return 'Cash received';
  }
}

function billTransactionSummary(payload: BillPayload, transactions: BillTransaction[] = []) {
  const openingFine = parseAmount(payload.customer.openingFineBalance);
  const openingAmountDue = parseAmount(payload.customer.openingLabourBalance);
  const billFineGiven = calculateTotalFine(payload.items);
  const fineGiven = openingFine + billFineGiven;
  const initialFineReceived = receiptHasFine(payload.receiptType) ? parseAmount(payload.receivedFine) : 0;
  const initialLabourReceived = payload.receivedValue;
  const initialRateCutFine = parseAmount(payload.rateCutFine);
  const initialRateCutAmount = parseAmount(payload.rateCutAmount);
  const discountAmount = sanitizePayloadDiscountAmount(payload);
  const cashBankReceived = transactions.reduce((sum, transaction) => sum + transaction.cashAmount + transaction.bankAmount, 0);
  const fineReceived = transactions.reduce((sum, transaction) => sum + transaction.fineWeight, 0);
  const rateCutFine = initialRateCutFine + transactions.reduce((sum, transaction) => sum + transaction.rateCutFine, 0);
  const rateCutAmount = initialRateCutAmount + transactions.reduce((sum, transaction) => sum + transaction.rateCutAmount, 0);
  const postRateCutAmount = transactions.reduce((sum, transaction) => sum + transaction.rateCutAmount, 0);
  const fineCleared = initialFineReceived + fineReceived + rateCutFine;
  const fineBalance = fineGiven - fineCleared;
  const billFineBalance = billFineGiven - fineCleared;
  const calculatedBillAmountDue = Math.max(payload.subtotal + initialRateCutAmount - initialLabourReceived - discountAmount, 0);
  const billAmountDue =
    payload.autoRoundFigure || parseAmount(payload.finalAmountOverride) > 0 ? payload.netTotal : calculatedBillAmountDue;
  const initialLabourBalance = Math.max(openingAmountDue + billAmountDue, 0);
  const billLabourBalance = Math.max(billAmountDue - cashBankReceived + postRateCutAmount, 0);

  return {
    cashBankReceived,
    billFineAdvance: Math.max(-billFineBalance, 0),
    billFineBalance: Math.max(billFineBalance, 0),
    billFineGiven,
    billLabourBalance,
    cashReceivedDisplay: initialLabourReceived + cashBankReceived,
    discountAmount,
    fineAdvance: Math.max(-fineBalance, 0),
    fineBalance: Math.max(fineBalance, 0),
    fineCleared,
    fineGiven,
    fineReceived,
    initialFineReceived,
    initialLabourReceived,
    initialRateCutAmount,
    initialRateCutFine,
    openingFine,
    openingAmountDue,
    rateCutAdjustsLabour: true,
    labourBalance: Math.max(initialLabourBalance - cashBankReceived + postRateCutAmount, 0),
    outstandingBeforeRateCut: Math.max(initialLabourBalance + postRateCutAmount, 0),
    postRateCutAmount,
    rateCutApplied: rateCutAmount,
    rateCutAmount,
    rateCutFine,
  };
}

function receiptLinesWithTransactions(payload: BillPayload, transactions: BillTransaction[] = []) {
  const hasInitialRateCut = parseAmount(payload.rateCutFine) > 0 || parseAmount(payload.rateCutAmount) > 0;
  const hasDiscount = sanitizePayloadDiscountAmount(payload) > 0;
  if (!transactions.length && !hasInitialRateCut && !hasDiscount) {
    return receiptLines(payload);
  }

  const language = payload.language;
  const summary = billTransactionSummary(payload, transactions);
  const lines = [
    `${t(language, 'fineGiven')}: ${formatCalcValue(summary.billFineGiven, 3) || '0'} gm`,
    receiptHasFine(payload.receiptType)
      ? `${t(language, 'fineReceived')}: GW ${payload.receivedGrossWeight || '0'} x ${payload.receivedTouch || '0'}% = ${
          formatCalcValue(summary.initialFineReceived, 3) || '0'
        } gm`
      : `${t(language, 'fineReceived')}: 0 gm`,
  ];

  if (summary.fineReceived > 0) {
    lines.push(`Post bill fine rec: ${formatCalcValue(summary.fineReceived, 3)} gm`);
  }
  if (summary.rateCutFine > 0) {
    lines.push(`Rate cut amount: ${formatCalcValue(summary.rateCutFine, 3)} gm = ${formatBillMoney(summary.rateCutAmount, payload.autoRoundFigure)}`);
  }
  if (summary.discountAmount > 0) {
    lines.push(`Discount: ${formatBillMoney(summary.discountAmount, payload.autoRoundFigure)}`);
  }
  lines.push(
    summary.billFineAdvance > 0
      ? `${t(language, 'fineAdvance')}: ${formatCalcValue(summary.billFineAdvance, 3)} gm`
      : `${t(language, 'fineBalance')}: ${formatCalcValue(summary.billFineBalance, 3) || '0'} gm`,
  );

  if (summary.initialLabourReceived > 0) {
    lines.push(`Amount received: ${formatBillMoney(summary.initialLabourReceived, payload.autoRoundFigure)}`);
  }
  if (summary.cashBankReceived > 0) {
    lines.push(`Post bill amount rec: ${formatBillMoney(summary.cashBankReceived, payload.autoRoundFigure)}`);
  }

  return lines;
}

type FooterInfoRow = {
  label: string;
  value: string;
};

function footerInfoSections(payload: BillPayload, transactions: BillTransaction[] = []) {
  const language = payload.language;
  const summary = billTransactionSummary(payload, transactions);
  const fineRows: FooterInfoRow[] = [
    { label: t(language, 'fineGiven'), value: `${formatCalcValue(summary.billFineGiven, 3) || '0'} gm` },
    {
      label: t(language, 'fineReceived'),
      value: receiptHasFine(payload.receiptType)
        ? `GW ${payload.receivedGrossWeight || '0'} x ${payload.receivedTouch || '0'}% = ${formatCalcValue(summary.initialFineReceived, 3) || '0'} gm`
        : '0 gm',
    },
  ];

  if (summary.fineReceived > 0) {
    fineRows.push({ label: 'Post bill fine rec', value: `${formatCalcValue(summary.fineReceived, 3)} gm` });
  }
  if (summary.rateCutFine > 0) {
    fineRows.push({
      label: 'Rate cut fine less',
      value: `${formatCalcValue(summary.rateCutFine, 3)} gm`,
    });
  }
  fineRows.push({
    label: summary.billFineAdvance > 0 ? t(language, 'fineAdvance') : t(language, 'fineBalance'),
    value: `${formatCalcValue(summary.billFineAdvance > 0 ? summary.billFineAdvance : summary.billFineBalance, 3) || '0'} gm`,
  });

  const moneyRows: FooterInfoRow[] = [];
  if (summary.initialLabourReceived > 0) {
    moneyRows.push({
      label: 'Amount rec',
      value: formatBillMoney(summary.initialLabourReceived, payload.autoRoundFigure),
    });
  }
  if (summary.cashBankReceived > 0) {
    moneyRows.push({
      label: 'Post bill cash/bank',
      value: formatBillMoney(summary.cashBankReceived, payload.autoRoundFigure),
    });
  }
  if (summary.discountAmount > 0) {
    moneyRows.push({
      label: 'Discount',
      value: formatBillMoney(summary.discountAmount, payload.autoRoundFigure),
    });
  }

  return { fineRows, moneyRows };
}

function rateCutFooterNotes(payload: BillPayload, transactions: BillTransaction[] = []) {
  const summary = billTransactionSummary(payload, transactions);
  if (summary.rateCutAmount <= 0) {
    return [] as string[];
  }

  return [`(Added in labour: ${formatBillMoney(summary.rateCutAmount, payload.autoRoundFigure)})`];
}

function remainingBracketTextWithTransactions(payload: BillPayload, transactions: BillTransaction[] = []) {
  const summary = billTransactionSummary(payload, transactions);
  const fineLabel = summary.fineAdvance > 0 ? t(payload.language, 'fineAdvance') : t(payload.language, 'fineRemain');
  const fineValue = `${formatCalcValue(summary.fineAdvance > 0 ? summary.fineAdvance : summary.fineBalance, 3) || '0'} gm`;
  const labourValue = formatBillMoney(summary.labourBalance, payload.autoRoundFigure);
  return `[ ${fineLabel}: ${fineValue} | ${t(payload.language, 'labourRemain')}: ${labourValue} ]`;
}

function receiptHasFine(receiptType: ReceiptType) {
  return receiptType === 'fine' || receiptType === 'fine_cash';
}

function receiptHasCash(receiptType: ReceiptType) {
  return receiptType === 'cash' || receiptType === 'fine_cash';
}

function normalizeMirroredDiscount(
  rawDiscount: string,
  rawRateCutAmount: string,
  rawRateCutBookedRate: number,
  rawRateCutFine: string,
  isDirty: boolean,
) {
  if (isDirty) {
    return rawDiscount;
  }

  const discountValue = parseAmount(rawDiscount);
  const rateCutValue = parseAmount(rawRateCutAmount);
  const rateCutBookedRate = parseAmount(rawRateCutBookedRate);
  const rateCutFine = parseAmount(rawRateCutFine);
  const mirrorsRateCutAmount = discountValue > 0 && rateCutValue > 0 && Math.abs(discountValue - rateCutValue) < 0.01;
  const mirrorsBookedRate = discountValue > 0 && rateCutBookedRate > 0 && Math.abs(discountValue - rateCutBookedRate) < 0.01;

  if (rateCutFine > 0 && (mirrorsRateCutAmount || mirrorsBookedRate)) {
    return '';
  }

  return rawDiscount;
}

function fineReceiptRateUnitFromItems(material: MetalType, items: BillItemDraft[], rates: MetalRates) {
  const saleItem = items.find((item) => item.material === material && parseAmount(item.rate) > 0);
  if (saleItem) {
    const ratePerGram = parseAmount(saleItem.rate);
    return material === 'gold' ? ratePerGram * 10 : ratePerGram * 1000;
  }

  return getMetalRateUnit(material, rates);
}

function escapeDocumentTitle(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function withDocumentTitle(html: string, title: string) {
  const titleTag = `<title>${escapeDocumentTitle(title)}</title>`;
  return html.includes('<head>') ? html.replace('<head>', `<head>${titleTag}`) : `${titleTag}${html}`;
}

type ExactPdfTarget = 'web-canvas' | 'native-print';

function pdfPrintSize(payload: BillPayload) {
  const frame = webPdfFrameSize(payload);
  const pointPerCssPixel = 0.75;
  return {
    height: Math.round(frame.height * pointPerCssPixel),
    width: Math.round(frame.width * pointPerCssPixel),
  };
}

function webPdfFrameSize(payload: BillPayload) {
  const anyPayload = payload as any;
  if (anyPayload.pdfFrame && typeof anyPayload.pdfFrame.width === 'number' && typeof anyPayload.pdfFrame.height === 'number') {
    return { height: anyPayload.pdfFrame.height, width: anyPayload.pdfFrame.width };
  }
  return payload.billType === 'wholesale'
    ? { height: 900, width: 720 }
    : { height: 700, width: 660 };
}

function wrapNativePdfViewport(html: string) {
  if (!html.includes('<body')) {
    return `<div class="bill-pdf-viewport">${html}</div>`;
  }

  return html
    .replace(/<body([^>]*)>/i, '<body$1><div class="bill-pdf-viewport">')
    .replace(/<\/body>/i, '</div></body>');
}

function withExactPdfPage(payload: BillPayload, html: string, target: ExactPdfTarget = 'web-canvas') {
  const frame = webPdfFrameSize(payload);
  const cssFrame = frame;
  const exactPageStyle = `<style id="bill-book-exact-pdf-page">
    @page { size: ${cssFrame.width}px ${cssFrame.height}px; margin: 0; }
    * { box-sizing: border-box; }
    html,
    body {
      background: #fff !important;
      height: ${cssFrame.height}px !important;
      margin: 0 !important;
      max-height: ${cssFrame.height}px !important;
      min-height: ${cssFrame.height}px !important;
      overflow: hidden !important;
      padding: 0 !important;
      width: ${cssFrame.width}px !important;
      min-width: ${cssFrame.width}px !important;
    }
    .bill-pdf-viewport {
      background: #fff !important;
      height: ${cssFrame.height}px !important;
      left: 0 !important;
      margin: 0 !important;
      overflow: hidden !important;
      padding: 0 !important;
      position: relative !important;
      top: 0 !important;
      width: ${cssFrame.width}px !important;
    }
    .paper,
    .invoice {
      box-shadow: none !important;
      height: ${frame.height}px !important;
      margin: 0 !important;
      max-height: ${frame.height}px !important;
      max-width: ${frame.width}px !important;
      min-height: ${frame.height}px !important;
      overflow: hidden !important;
      transform: none !important;
      transform-origin: top left !important;
      width: ${frame.width}px !important;
    }
    ${target === 'native-print' ? '.bill-pdf-viewport > .paper, .bill-pdf-viewport > .invoice { position: absolute !important; left: 0 !important; top: 0 !important; }' : ''}
  </style>`;
  const titledHtml = withDocumentTitle(html, billDocumentName(payload));
  const styledHtml = titledHtml.includes('</head>')
    ? titledHtml.replace('</head>', `${exactPageStyle}</head>`)
    : `${exactPageStyle}${titledHtml}`;
  return target === 'native-print' ? wrapNativePdfViewport(styledHtml) : styledHtml;
}

async function renderBillPdfBlobOnWeb(payload: BillPayload, html: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return null;
  }

  const frame = webPdfFrameSize(payload);
  const page = pdfPrintSize(payload);
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const holder = document.createElement('div');
  holder.style.left = '-10000px';
  holder.style.height = `${frame.height}px`;
  holder.style.overflow = 'hidden';
  holder.style.pointerEvents = 'none';
  holder.style.position = 'fixed';
  holder.style.top = '0';
  holder.style.width = `${frame.width}px`;
  holder.innerHTML = withExactPdfPage(payload, html, 'web-canvas');
  document.body.appendChild(holder);

  try {
    await document.fonts?.ready;
    const element = holder.querySelector<HTMLElement>('.paper, .invoice') ?? holder;
    element.style.height = `${frame.height}px`;
    element.style.maxWidth = `${frame.width}px`;
    element.style.minHeight = `${frame.height}px`;
    element.style.overflow = 'hidden';
    element.style.width = `${frame.width}px`;
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      height: frame.height,
      logging: false,
      scale: 2,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      windowHeight: frame.height,
      windowWidth: frame.width,
      width: frame.width,
    });
    const pdf = new jsPDF({
      compress: true,
      format: [page.width, page.height],
      orientation: 'portrait',
      precision: 12,
      unit: 'pt',
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, page.width, page.height, undefined, 'FAST');
    return pdf.output('blob');
  } finally {
    holder.remove();
  }
}

function downloadBlobOnWeb(blob: Blob, fileName: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof URL === 'undefined') {
    return false;
  }

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  return true;
}

async function downloadBillPdfOnWeb(payload: BillPayload, html: string) {
  if (shouldOpenWebPrintInsteadOfDownload()) {
    return printBillHtmlOnWeb(payload, html);
  }

  const blob = await renderBillPdfBlobOnWeb(payload, html);
  if (!blob || typeof document === 'undefined' || typeof URL === 'undefined') {
    return false;
  }

  return downloadBlobOnWeb(blob, safePdfFileName(payload));
}

async function prepareBillPdfFileOnWeb(payload: BillPayload, html: string, target: WebPdfShareTarget): Promise<WebPdfShareFile | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof File === 'undefined') {
    return null;
  }

  const blob = await renderBillPdfBlobOnWeb(payload, html);
  if (!blob) {
    return null;
  }

  const fileName = safePdfFileName(payload);
  return {
    file: new File([blob], fileName, { type: 'application/pdf' }),
    fileName,
    html,
    payload,
    target,
    title: billDocumentName(payload),
  };
}

function shouldOpenWebPrintInsteadOfDownload() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  const navigatorInfo = window.navigator;
  const userAgent = navigatorInfo.userAgent || '';
  return /iPad|iPhone|iPod/i.test(userAgent) || (navigatorInfo.platform === 'MacIntel' && navigatorInfo.maxTouchPoints > 1);
}

function getWebShareNavigator() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  return window.navigator as WebNavigatorShare;
}

async function sharePreparedPdfFileOnWeb(prepared: WebPdfShareFile, includeText = false) {
  const webNavigator = getWebShareNavigator();
  if (!webNavigator?.share) {
    return false;
  }

  const fileShareData = { files: [prepared.file], title: prepared.title };
  if (webNavigator.canShare && !webNavigator.canShare(fileShareData)) {
    return false;
  }

  await webNavigator.share({
    ...fileShareData,
    ...(includeText ? { text: buildShareMessage(prepared.payload) } : {}),
  });
  return true;
}

function downloadPreparedPdfOnWeb(prepared: WebPdfShareFile) {
  if (shouldOpenWebPrintInsteadOfDownload()) {
    return printBillHtmlOnWeb(prepared.payload, prepared.html);
  }

  return downloadBlobOnWeb(prepared.file, prepared.fileName);
}

async function createNamedNativePdf(payload: BillPayload, html: string) {
  const size = pdfPrintSize(payload);
  const exactHtml = withExactPdfPage(payload, html, 'native-print');
  const { uri } = await Print.printToFileAsync({
    height: size.height,
    html: exactHtml,
    margins: { bottom: 0, left: 0, right: 0, top: 0 },
    textZoom: 100,
    width: size.width,
  });
  const ExpoFile = FileSystem.File as unknown as new (...uris: unknown[]) => ExpoFsFile;
  const sourceFile = new ExpoFile(uri);
  const targetFile = new ExpoFile(FileSystem.Paths.cache, safePdfFileName(payload));
  if (targetFile.exists) {
    targetFile.delete();
  }
  sourceFile.copy(targetFile);
  return targetFile.uri;
}

async function shareNativePdfFile(uri: string, payload: BillPayload, titlePrefix = 'Share') {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      UTI: 'com.adobe.pdf',
      dialogTitle: `${titlePrefix} ${safePdfFileName(payload)}`,
      mimeType: 'application/pdf',
    });
  } else {
    Alert.alert('PDF ready', uri);
  }
}

async function sharePdfDirectlyToWhatsapp(uri: string, payload: BillPayload) {
  if (Platform.OS !== 'android') {
    return false;
  }

  const phone = normalizeWhatsappNumber(payload.customer.mobile);
  if (!phone) {
    Alert.alert('Customer number missing', 'Customer ka mobile number daalo ya Other share use karo.');
    return false;
  }

  if (!(NativeModules as Record<string, unknown>).RNShare) {
    return false;
  }

  let NativeShare: typeof import('react-native-share').default;
  try {
    ({ default: NativeShare } = await import('react-native-share'));
  } catch {
    return false;
  }
  const pdfName = safePdfFileName(payload);
  const baseOptions = {
    failOnCancel: false,
    filename: pdfName,
    title: billDocumentName(payload),
    type: 'application/pdf',
    url: uri,
    useInternalStorage: true,
    whatsAppNumber: phone,
  };
  const targets = [
    { packageName: 'com.whatsapp', social: NativeShare.Social.WHATSAPP },
    { packageName: 'com.whatsapp.w4b', social: NativeShare.Social.WHATSAPPBUSINESS },
  ];

  let lastError: unknown = null;
  for (const target of targets) {
    try {
      const packageCheck = await NativeShare.isPackageInstalled(target.packageName).catch(() => ({
        isInstalled: true,
      }));
      if (!packageCheck.isInstalled) {
        continue;
      }

      await NativeShare.shareSingle({
        ...baseOptions,
        social: target.social,
      } as never);
      return true;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('WhatsApp installed nahi mila.');
}

function printBillHtmlOnWeb(payload: BillPayload, html: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', billDocumentName(payload));
    iframe.style.border = '0';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.top = '0';
    iframe.style.width = '1px';

    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 1500);
    };

    iframe.onload = () => {
      window.setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          cleanup();
          resolve(true);
        } catch (error) {
          cleanup();
          reject(error);
        }
      }, 250);
    };
    iframe.onerror = () => {
      cleanup();
      reject(new Error('Unable to prepare bill print.'));
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = withExactPdfPage(payload, html);
  });
}

function printHtmlOnWeb(title: string, html: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', title);
    iframe.style.border = '0';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.top = '0';
    iframe.style.width = '1px';

    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 1500);
    };

    iframe.onload = () => {
      window.setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          cleanup();
          resolve(true);
        } catch (error) {
          cleanup();
          reject(error);
        }
      }, 250);
    };
    iframe.onerror = () => {
      cleanup();
      reject(new Error('Unable to prepare voucher print.'));
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = withDocumentTitle(html, title);
  });
}

async function requestNotificationAccess() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission =
        window.Notification.permission === 'default'
          ? await window.Notification.requestPermission()
          : window.Notification.permission;
      return permission === 'granted';
    }
    return false;
  }

  try {
    const Notifications = await import('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    const finalStatus = current.granted ? current : await Notifications.requestPermissionsAsync();
    return !!finalStatus.granted;
  } catch {
    return false;
  }
}

function playReminderTone() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  try {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    window.setTimeout(() => {
      oscillator.stop();
      void context.close();
    }, 420);
  } catch {
    // Browser may block audio until user interaction.
  }
}

async function cancelScheduledReminderNotification(notificationId: string) {
  if (!notificationId || Platform.OS === 'web') {
    return;
  }

  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Reminder DB row remains authoritative if notification cancellation is unavailable.
  }
}

async function scheduleReminderNotification(reminder: BillReminder) {
  const granted = await requestNotificationAccess();
  if (!granted) {
    return '';
  }

  const dueTime = new Date(reminder.dueAt).getTime();
  const delayMs = Math.max(dueTime - Date.now(), 0);
  const title = `Fine reminder: Bill ${reminder.billNo}`;
  const body = `${reminder.customerName || 'Party'} ka fine jama reminder.`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window && delayMs <= 24 * 60 * 60 * 1000) {
      window.setTimeout(() => {
        if (window.Notification.permission === 'granted') {
          new window.Notification(title, { body });
        }
      }, delayMs);
      return `web-${reminder.id}`;
    }
    return '';
  }

  try {
    const Notifications = await import('expo-notifications');
    return await Notifications.scheduleNotificationAsync({
      content: { body, title },
      trigger: {
        date: new Date(Math.max(dueTime, Date.now() + 1000)),
        type: Notifications.SchedulableTriggerInputTypes.DATE,
      },
    });
  } catch {
    return '';
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <JewelleryBillBook />
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

function JewelleryBillBook() {
  const db = useDatabase();
  const [screen, setScreen] = useState<Screen>('home');
  const [latestRate, setLatestRate] = useState<Rate | null>(null);
  const [rateDate, setRateDate] = useState(localIsoDate());
  const [goldRate, setGoldRate] = useState('62310');
  const [silverRate, setSilverRate] = useState('1898');
  const [billNo, setBillNo] = useState(101);
  const [billDate, setBillDate] = useState(localIsoDate());
  const [billType, setBillType] = useState<BillType>('estimate');
  const [language, setLanguage] = useState<Language>('en');
  const [customer, setCustomer] = useState<CustomerDraft>({ address: '', mobile: '', name: '' });
  const [items, setItems] = useState<BillItemDraft[]>([
    autoCalculateItem(
      {
        ...emptyItem('gold'),
        itemName: 'Ring',
        labour: '3',
        pcs: '4',
        touch: '77',
        weight: '6.26',
      },
      { gold10gRate: 62310, silver1kgRate: 1898 },
    ),
  ]);
  const [receiptType, setReceiptType] = useState<ReceiptType>('none');
  const [receiptMaterial, setReceiptMaterial] = useState<MetalType>('gold');
  const [receivedFine, setReceivedFine] = useState('');
  const [receivedGrossWeight, setReceivedGrossWeight] = useState('');
  const [receivedTouch, setReceivedTouch] = useState('');
  const [receivedCash, setReceivedCash] = useState('');
  const [receivedPriceOverride, setReceivedPriceOverride] = useState('');
  const [rateCutFine, setRateCutFine] = useState('');
  const [rateCutAmount, setRateCutAmount] = useState('');
  const [rateCutAdjustsLabour, setRateCutAdjustsLabour] = useState(true);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountDirty, setDiscountDirty] = useState(false);
  const [autoRoundFigure, setAutoRoundFigure] = useState(false);
  const [finalAmountOverride, setFinalAmountOverride] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState('3');
  const [reminderTime, setReminderTime] = useState('10:00');
  const [allBills, setAllBills] = useState<RecentBill[]>([]);
  const [allBillTransactions, setAllBillTransactions] = useState<BillTransaction[]>([]);
  const [allPartyTransactions, setAllPartyTransactions] = useState<PartyTransaction[]>([]);
  const [cashBankEntries, setCashBankEntries] = useState<CashBankEntry[]>([]);
  const [supplierAccounts, setSupplierAccounts] = useState<SupplierAccount[]>([]);
  const [supplierLedgers, setSupplierLedgers] = useState<SupplierLedgerSummary[]>([]);
  const [allSupplierTransactions, setAllSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [recentBills, setRecentBills] = useState<RecentBill[]>([]);
  const [partyFolders, setPartyFolders] = useState<PartyFolder[]>([]);
  const [partyLedgers, setPartyLedgers] = useState<PartyLedgerSummary[]>([]);
  const [itemNameOptions, setItemNameOptions] = useState<ItemNameOption[]>([]);
  const [billReminders, setBillReminders] = useState<BillReminder[]>([]);
  const [marketStockRows, setMarketStockRows] = useState<MarketStockSummary[]>([]);
  const [marketDate, setMarketDate] = useState(localIsoDate());
  const [marketGoldWeight, setMarketGoldWeight] = useState('');
  const [marketSilverWeight, setMarketSilverWeight] = useState('');
  const [marketNote, setMarketNote] = useState('');
  const [billPeriod, setBillPeriod] = useState<BillPeriod>('today');
  const [customFrom, setCustomFrom] = useState(localIsoDate());
  const [customTo, setCustomTo] = useState(localIsoDate());
  const [clearBookPeriod, setClearBookPeriod] = useState<BillPeriod>('today');
  const [clearCustomFrom, setClearCustomFrom] = useState(localIsoDate());
  const [clearCustomTo, setClearCustomTo] = useState(localIsoDate());
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedPartyTransactions, setSelectedPartyTransactions] = useState<PartyTransaction[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedSupplierTransactions, setSelectedSupplierTransactions] = useState<SupplierTransaction[]>([]);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [viewingBillId, setViewingBillId] = useState<string | null>(null);
  const [viewingBillPayload, setViewingBillPayload] = useState<BillPayload | null>(null);
  const [viewingBillTransactions, setViewingBillTransactions] = useState<BillTransaction[]>([]);
  const [billViewBackScreen, setBillViewBackScreen] = useState<Screen>('bills');
  const [backupMessage, setBackupMessage] = useState('');
  const [lastSavedPayload, setLastSavedPayload] = useState<BillPayload | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [lastSavedEntryStatus, setLastSavedEntryStatus] = useState<OfficeEntryStatus>('pending');
  const [sharePromptPayload, setSharePromptPayload] = useState<BillPayload | null>(null);
  const [sharePromptMessage, setSharePromptMessage] = useState('');
  const [webPdfShareFile, setWebPdfShareFile] = useState<WebPdfShareFile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Data ready.');
  const dueReminderTonePlayedRef = useRef('');
  const syncLoopRunningRef = useRef(false);

  const rates: MetalRates = useMemo(
    () => ({
      gold10gRate: parseAmount(goldRate),
      silver1kgRate: parseAmount(silverRate),
    }),
    [goldRate, silverRate],
  );

  const calculatedItems = useMemo(() => items.map((item) => autoCalculateItem(item, rates)), [items, rates]);
  const defaultReceivedRate = useMemo(
    () => formatCalcValue(fineReceiptRateUnitFromItems(receiptMaterial, calculatedItems, rates), 2),
    [calculatedItems, rates, receiptMaterial],
  );
  const effectiveReceivedRate = receiptHasFine(receiptType) ? defaultReceivedRate : '';
  const calculatedReceivedFine = useMemo(
    () => formatCalcValue(calculateReceivedFine(receivedGrossWeight, receivedTouch), 3),
    [receivedGrossWeight, receivedTouch],
  );
  const activeReceivedFine =
    receiptHasFine(receiptType) && parseAmount(calculatedReceivedFine) > 0 ? calculatedReceivedFine : receivedFine;
  const rateCutBookedInfo = useMemo(() => bookedRateInfoFromItems(calculatedItems), [calculatedItems]);
  const activeRateCutFine = useMemo(() => {
    const fine = roundFineToHalfGram(parseAmount(rateCutFine));
    return fine > 0 ? formatCalcValue(fine, 3) : '';
  }, [rateCutFine]);
  const rateCutAutoAmount = useMemo(
    () => parseAmount(activeRateCutFine) * rateCutBookedInfo.ratePerGram,
    [activeRateCutFine, rateCutBookedInfo.ratePerGram],
  );
  const activeRateCutAmount = useMemo(() => {
    const amount = parseAmount(rateCutAmount);
    return parseAmount(activeRateCutFine) > 0 && amount > 0 ? formatCalcValue(amount, 2) : '';
  }, [activeRateCutFine, rateCutAmount]);
  const resolvedDiscountInput = useMemo(
    () =>
      normalizeMirroredDiscount(
        discountAmount,
        activeRateCutAmount,
        rateCutBookedInfo.unitRate,
        activeRateCutFine,
        discountDirty,
      ),
    [activeRateCutAmount, activeRateCutFine, discountAmount, discountDirty, rateCutBookedInfo.unitRate],
  );
  const activeDiscountAmount = useMemo(() => {
    const amount = parseAmount(resolvedDiscountInput);
    return amount > 0 ? formatCalcValue(amount, 2) : '';
  }, [resolvedDiscountInput]);
  const autoTotals = useMemo(
    () =>
      calculateNetTotal(
        calculatedItems,
        {
          receiptMaterial,
          receiptType,
          receivedCash,
          receivedFine: activeReceivedFine,
          receivedGrossWeight,
          receivedPriceOverride: '',
          receivedRate: effectiveReceivedRate,
          receivedTouch,
        },
        rates,
      ),
    [
      calculatedItems,
      activeReceivedFine,
      effectiveReceivedRate,
      rates,
      receiptMaterial,
      receiptType,
      receivedCash,
      receivedGrossWeight,
      receivedTouch,
    ],
  );
  const totals = useMemo(() => {
    const override = finalAmountOverride.trim();
    const roundFigureEnabled = autoRoundFigure && !override;
    const rateCutValue = parseAmount(activeRateCutAmount);
    const discountValue = parseAmount(activeDiscountAmount);
    const subtotal = Math.max(autoTotals.subtotal, 0);
    const autoNetTotal = Math.max(subtotal + rateCutValue - autoTotals.receivedValue - discountValue, 0);
    const roundedNetTotal = roundToTen(autoNetTotal);
    return {
      ...autoTotals,
      autoNetTotal,
      baseLabourSubtotal: autoTotals.subtotal,
      discountValue,
      rateCutValue,
      roundFigureEnabled,
      roundedNetTotal,
      finalAmountOverride: override,
      subtotal,
      netTotal: override ? Math.max(parseAmount(override), 0) : roundFigureEnabled ? roundedNetTotal : autoNetTotal,
    };
  }, [activeDiscountAmount, activeRateCutAmount, autoRoundFigure, autoTotals, finalAmountOverride, rateCutAdjustsLabour]);

  const billPayload: BillPayload = useMemo(
    () => ({
      billDate,
      billNo,
      billType,
      autoRoundFigure: totals.roundFigureEnabled,
      customer,
      items: calculatedItems,
      language,
      finalAmountOverride: totals.finalAmountOverride,
      netTotal: totals.netTotal,
      discountAmount: activeDiscountAmount,
      receiptMaterial,
      receiptType,
      receivedCash,
      receivedFine: activeReceivedFine,
      receivedGrossWeight,
      receivedPriceOverride: receiptHasFine(receiptType) ? '' : receivedPriceOverride,
      receivedTouch,
      receivedValue: totals.receivedValue,
      rateCutFine: activeRateCutFine,
      rateCutAmount: activeRateCutAmount,
      rateCutAdjustsLabour: true,
      rateCutBookedRate: parseAmount(activeRateCutFine) > 0 ? rateCutBookedInfo.unitRate : 0,
      subtotal: totals.subtotal,
    }),
    [
      billDate,
      billNo,
      billType,
      calculatedItems,
      customer,
      activeReceivedFine,
      language,
      rateCutAdjustsLabour,
      receiptMaterial,
      receiptType,
      receivedCash,
      receivedGrossWeight,
      receivedPriceOverride,
      receivedTouch,
      activeRateCutAmount,
      activeRateCutFine,
      rateCutBookedInfo.unitRate,
      totals.finalAmountOverride,
      totals.netTotal,
      totals.receivedValue,
      totals.roundFigureEnabled,
      totals.subtotal,
      activeDiscountAmount,
    ],
  );

  const filteredBills = useMemo(
    () => allBills.filter((bill) => isBillInPeriod(bill.billDate, billPeriod, customFrom, customTo)),
    [allBills, billPeriod, customFrom, customTo],
  );
  const clearBookFilteredBills = useMemo(
    () => allBills.filter((bill) => isBillInPeriod(bill.billDate, clearBookPeriod, clearCustomFrom, clearCustomTo)),
    [allBills, clearBookPeriod, clearCustomFrom, clearCustomTo],
  );
  const selectedPartyFolder = useMemo(
    () => partyFolders.find((folder) => folder.customerId === selectedPartyId) ?? null,
    [partyFolders, selectedPartyId],
  );
  const partyLedgerMap = useMemo(
    () => new Map(partyLedgers.map((ledger) => [ledger.customerId, ledger])),
    [partyLedgers],
  );
  const selectedPartyLedger = useMemo(
    () => (selectedPartyId ? partyLedgerMap.get(selectedPartyId) ?? null : null),
    [partyLedgerMap, selectedPartyId],
  );
  const selectedSupplier = useMemo(
    () => supplierAccounts.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, supplierAccounts],
  );
  const supplierLedgerMap = useMemo(
    () => new Map(supplierLedgers.map((ledger) => [ledger.supplierId, ledger])),
    [supplierLedgers],
  );
  const selectedSupplierLedger = useMemo(
    () => (selectedSupplierId ? supplierLedgerMap.get(selectedSupplierId) ?? null : null),
    [selectedSupplierId, supplierLedgerMap],
  );
  const selectedPartyBills = useMemo(
    () => (selectedPartyFolder ? allBills.filter((bill) => bill.customerId === selectedPartyFolder.customerId) : []),
    [allBills, selectedPartyFolder],
  );

  async function loadPartyTransactions(customerId: string | null = selectedPartyId) {
    if (!customerId) {
      setSelectedPartyTransactions([]);
      return [];
    }
    const transactions = await getPartyTransactions(db, customerId);
    setSelectedPartyTransactions(transactions);
    return transactions;
  }

  async function openParty(customerId: string) {
    setSelectedPartyId(customerId);
    await loadPartyTransactions(customerId);
    setScreen('partyBills');
  }

  async function loadSupplierTransactions(supplierId: string | null = selectedSupplierId) {
    if (!supplierId) {
      setSelectedSupplierTransactions([]);
      return [];
    }
    const transactions = await getSupplierTransactions(db, supplierId);
    setSelectedSupplierTransactions(transactions);
    return transactions;
  }

  async function openSupplier(supplierId: string) {
    setSelectedSupplierId(supplierId);
    await loadSupplierTransactions(supplierId);
    setScreen('suppliers');
  }

  async function refreshScreen() {
    await repairMirroredDiscountRows(db);
    const [
      rate,
      nextBillNo,
      recent,
      folders,
      ledgers,
      itemNames,
      reminders,
      marketRows,
      bills,
      billTransactions,
      partyTransactions,
      ledgerEntries,
      suppliers,
      supplierLedgerRows,
      supplierTransactions,
    ] = await Promise.all([
      getLatestRate(db),
      getNextBillNo(db),
      getRecentBills(db),
      getPartyFolders(db),
      getPartyLedgerSummaries(db),
      getItemNames(db),
      getBillReminders(db),
      getMarketStockSummaries(db),
      getAllBills(db),
      getAllBillTransactions(db),
      getAllPartyTransactions(db),
      getAllCashBankEntries(db),
      getSupplierAccounts(db),
      getSupplierLedgerSummaries(db),
      getAllSupplierTransactions(db),
    ]);

    if (rate) {
      setLatestRate(rate);
      setRateDate(rate.rateDate);
      setGoldRate(String(rate.gold10gRate));
      setSilverRate(String(rate.silver1kgRate));
    }

    setBillNo(nextBillNo);
    setAllBills(bills);
    setAllBillTransactions(billTransactions);
    setAllPartyTransactions(partyTransactions);
    setCashBankEntries(ledgerEntries);
    setSupplierAccounts(suppliers);
    setSupplierLedgers(supplierLedgerRows);
    setAllSupplierTransactions(supplierTransactions);
    setRecentBills(recent);
    setPartyFolders(folders);
    setPartyLedgers(ledgers);
    setItemNameOptions(itemNames);
    setBillReminders(reminders);
    setMarketStockRows(marketRows);
    if (selectedPartyId) {
      setSelectedPartyTransactions(await getPartyTransactions(db, selectedPartyId));
    }
    if (selectedSupplierId) {
      setSelectedSupplierTransactions(await getSupplierTransactions(db, selectedSupplierId));
    }
  }

  function goBackInApp() {
    if (webPdfShareFile) {
      setWebPdfShareFile(null);
      return true;
    }

    if (sharePromptPayload) {
      setSharePromptPayload(null);
      setSharePromptMessage('');
      return true;
    }

    if (screen === 'addParty') {
      setScreen('parties');
      return true;
    }

    if (screen === 'partyTransact') {
      setScreen('partyBills');
      return true;
    }

    if (screen === 'addSupplier' || screen === 'supplierTransact') {
      setScreen('suppliers');
      return true;
    }

    if (screen === 'partyBills') {
      setScreen('parties');
      return true;
    }

    if (screen === 'suppliers' && selectedSupplierId) {
      setSelectedSupplierId(null);
      setSelectedSupplierTransactions([]);
      return true;
    }

    if (screen === 'billView') {
      setScreen(billViewBackScreen);
      return true;
    }

    if (screen !== 'home') {
      setScreen('home');
      return true;
    }

    return true;
  }

  useEffect(() => {
    let mounted = true;

    async function loadAndSync() {
      await refreshScreen();
      if (!mounted) {
        return;
      }

      setIsSyncing(true);
      try {
        const result = await syncPendingChanges(db);
        if (!mounted) {
          return;
        }
        setSyncMessage(clientSyncMessage(result.ok));
        await refreshScreen();
      } catch (error) {
        if (!mounted) {
          return;
        }
        setSyncMessage(clientSyncMessage(false));
      } finally {
        if (mounted) {
          setIsSyncing(false);
        }
      }
    }

    void loadAndSync();

    return () => {
      mounted = false;
    };
  }, [db]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', goBackInApp);
    return () => subscription.remove();
  }, [billViewBackScreen, screen, selectedSupplierId, sharePromptPayload, webPdfShareFile]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void runOnlineSync(false);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [db]);

  useEffect(() => {
    const dueKey = billReminders
      .filter((reminder) => reminder.status === 'active' && reminderIsDue(reminder))
      .map((reminder) => reminder.id)
      .sort()
      .join('|');

    if (!dueKey || dueReminderTonePlayedRef.current === dueKey) {
      return;
    }

    dueReminderTonePlayedRef.current = dueKey;
    playReminderTone();
  }, [billReminders]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    window.history.pushState({ billBookScreen: screen, createdAt: Date.now() }, '', window.location.href);
    const onPopState = () => {
      goBackInApp();
      window.setTimeout(() => {
        window.history.pushState({ billBookScreen: screen, createdAt: Date.now() }, '', window.location.href);
      }, 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [billViewBackScreen, screen, selectedSupplierId, sharePromptPayload, webPdfShareFile]);

  async function runOnlineSync(showAlert = false) {
    if (syncLoopRunningRef.current) {
      return { ok: true, message: 'Sync already running.' };
    }
    syncLoopRunningRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncPendingChanges(db);
      const message = clientSyncMessage(result.ok);
      setSyncMessage(message);
      await refreshScreen();
      if (showAlert) {
        Alert.alert(result.ok ? 'Data updated' : 'Internet update pending', message);
      }
      return result;
    } catch (error) {
      const message = clientSyncMessage(false);
      setSyncMessage(message);
      if (showAlert) {
        Alert.alert('Internet update pending', message);
      }
      return { ok: false, message };
    } finally {
      syncLoopRunningRef.current = false;
      setIsSyncing(false);
    }
  }

  function resetBillDraft() {
    setCustomer({ address: '', mobile: '', name: '' });
    setItems([emptyItem('gold')]);
    setBillDate(localIsoDate());
    setBillType('estimate');
    setReceiptType('none');
    setReceiptMaterial('gold');
    setReceivedFine('');
    setReceivedGrossWeight('');
    setReceivedTouch('');
    setReceivedCash('');
    setReceivedPriceOverride('');
    setRateCutFine('');
    setRateCutAmount('');
    setRateCutAdjustsLabour(true);
    setDiscountAmount('');
    setDiscountDirty(false);
    setAutoRoundFigure(false);
    setFinalAmountOverride('');
    setReminderEnabled(false);
    setReminderDays('3');
    setReminderTime('10:00');
  }

  function startBlankBill() {
    resetBillDraft();
    setEditingBillId(null);
    setScreen('bill');
  }

  function startPartyBill(folder: PartyFolder) {
    const ledger = partyLedgerMap.get(folder.customerId);
    setCustomer({
      address: folder.customerAddress,
      id: folder.customerId,
      mobile: folder.customerMobile,
      name: folder.customerName,
      openingFineBalance: String(currentPartyFineOpening(folder, ledger) || ''),
      openingLabourBalance: String(currentPartyAmountOpening(folder, ledger) || ''),
      openingNote: folder.openingNote,
    });
    setItems([emptyItem('gold')]);
    setBillDate(localIsoDate());
    setBillType('estimate');
    setReceiptType('none');
    setReceiptMaterial('gold');
    setReceivedFine('');
    setReceivedGrossWeight('');
    setReceivedTouch('');
    setReceivedCash('');
    setReceivedPriceOverride('');
    setRateCutFine('');
    setRateCutAmount('');
    setRateCutAdjustsLabour(true);
    setDiscountAmount('');
    setDiscountDirty(false);
    setAutoRoundFigure(false);
    setFinalAmountOverride('');
    setReminderEnabled(false);
    setReminderDays('3');
    setReminderTime('10:00');
    setEditingBillId(null);
    setScreen('bill');
  }

  function selectPartyForBill(folder: PartyFolder) {
    const ledger = partyLedgerMap.get(folder.customerId);
    setCustomer({
      address: folder.customerAddress,
      id: folder.customerId,
      mobile: folder.customerMobile,
      name: folder.customerName,
      openingFineBalance: String(currentPartyFineOpening(folder, ledger) || ''),
      openingLabourBalance: String(currentPartyAmountOpening(folder, ledger) || ''),
      openingNote: folder.openingNote,
    });
  }

  function openClearBooksForDate(date = localIsoDate()) {
    setClearBookPeriod('custom');
    setClearCustomFrom(date);
    setClearCustomTo(date);
    setScreen('clearBooks');
  }

  function updateCustomer(key: keyof CustomerDraft, value: string) {
    setCustomer((current) => {
      const next = { ...current, [key]: value };
      if (key === 'name' && current.id && value !== current.name) {
        const { id: _id, ...manualCustomer } = next;
        return manualCustomer;
      }
      return next;
    });
  }

  function clearFinalOverrideForAutoCalc() {
    setFinalAmountOverride((current) => (current ? '' : current));
  }

  function updateAutoRoundFigure(value: boolean) {
    setAutoRoundFigure(value);
    if (value) {
      setFinalAmountOverride('');
    }
  }

  function updateFinalAmountOverride(value: string) {
    if (value.trim()) {
      setAutoRoundFigure(false);
    }
    setFinalAmountOverride(value);
  }

  function updateBillGoldRate(value: string) {
    clearFinalOverrideForAutoCalc();
    const nextRates = { ...rates, gold10gRate: parseAmount(value) };
    setGoldRate(value);
    setItems((current) =>
      current.map((item) =>
        item.material === 'gold' ? { ...autoCalculateItem({ ...item, rate: '' }, nextRates), rate: '' } : item,
      ),
    );
  }

  function updateBillSilverRate(value: string) {
    clearFinalOverrideForAutoCalc();
    const nextRates = { ...rates, silver1kgRate: parseAmount(value) };
    setSilverRate(value);
    setItems((current) =>
      current.map((item) =>
        item.material === 'silver' ? { ...autoCalculateItem({ ...item, rate: '' }, nextRates), rate: '' } : item,
      ),
    );
  }

  function updateReceiptType(value: ReceiptType) {
    clearFinalOverrideForAutoCalc();
    setReceiptType(value);
  }

  function updateReceiptMaterial(value: MetalType) {
    clearFinalOverrideForAutoCalc();
    setReceiptMaterial(value);
  }

  function updateReceivedGrossWeight(value: string) {
    clearFinalOverrideForAutoCalc();
    setReceivedGrossWeight(value);
  }

  function updateReceivedTouch(value: string) {
    clearFinalOverrideForAutoCalc();
    setReceivedTouch(value);
  }

  function updateReceivedCash(value: string) {
    clearFinalOverrideForAutoCalc();
    setReceivedCash(value);
  }

  function updateReceivedPriceOverride(value: string) {
    clearFinalOverrideForAutoCalc();
    setReceivedPriceOverride(value);
  }

  function updateRateCutFine(value: string) {
    clearFinalOverrideForAutoCalc();
    setRateCutFine(value);
  }

  function updateRateCutAmount(value: string) {
    clearFinalOverrideForAutoCalc();
    setRateCutAmount(value);
  }

  function updateDiscountAmount(value: string) {
    clearFinalOverrideForAutoCalc();
    setDiscountDirty(true);
    setDiscountAmount(value);
  }

  function updateItem(index: number, key: keyof BillItemDraft, value: string) {
    clearFinalOverrideForAutoCalc();
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        const nextItem = { ...item, [key]: value };
        if (key === 'material') {
          nextItem.rate = '';
        }
        const calculated = autoCalculateItem(nextItem, rates);
        return key === 'rate' || key === 'material' ? { ...calculated, rate: nextItem.rate } : calculated;
      }),
    );
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  function buildCleanPayload(payload: BillPayload): BillPayload {
    const cleanItems = payload.items.filter((item) => item.itemName.trim());
    const finalOverride = payload.finalAmountOverride.trim();
    const cleanRateCutInfo = bookedRateInfoFromItems(cleanItems);
    const cleanRateCutFine = roundFineToHalfGram(parseAmount(payload.rateCutFine));
    const cleanRateCutAmount = cleanRateCutFine > 0 ? parseAmount(payload.rateCutAmount) : 0;
    const cleanDiscountAmount = Math.max(sanitizePayloadDiscountAmount(payload), 0);
    const cleanReceivedRate =
      receiptHasFine(payload.receiptType)
        ? formatCalcValue(fineReceiptRateUnitFromItems(payload.receiptMaterial, cleanItems, rates), 2)
        : '';
    const cleanTotals = calculateNetTotal(
      cleanItems,
      {
        receiptMaterial: payload.receiptMaterial,
        receiptType: payload.receiptType,
        receivedCash: payload.receivedCash,
        receivedFine: payload.receivedFine,
        receivedGrossWeight: payload.receivedGrossWeight,
        receivedPriceOverride: '',
        receivedRate: cleanReceivedRate,
        receivedTouch: payload.receivedTouch,
      },
      rates,
    );
    const subtotal = Math.max(cleanTotals.subtotal, 0);
    const autoNetTotal = Math.max(subtotal + cleanRateCutAmount - cleanTotals.receivedValue - cleanDiscountAmount, 0);
    const netTotal = finalOverride
      ? Math.max(parseAmount(finalOverride), 0)
      : payload.autoRoundFigure
        ? roundToTen(autoNetTotal)
        : autoNetTotal;

    return {
      ...payload,
      autoRoundFigure: !finalOverride && payload.autoRoundFigure,
      billDate: dateInputToIso(payload.billDate),
      customer: {
        address: payload.customer.address.trim(),
        id: payload.customer.id,
        mobile: payload.customer.mobile.trim(),
        name: payload.customer.name.trim(),
        openingFineBalance: payload.customer.openingFineBalance,
        openingLabourBalance: payload.customer.openingLabourBalance,
        openingNote: payload.customer.openingNote,
      },
      finalAmountOverride: finalOverride,
      discountAmount: cleanDiscountAmount > 0 ? formatCalcValue(cleanDiscountAmount, 2) : '',
      items: cleanItems,
      netTotal,
      rateCutFine: cleanRateCutFine > 0 ? formatCalcValue(cleanRateCutFine, 3) : '',
      rateCutAmount: cleanRateCutAmount > 0 ? formatCalcValue(cleanRateCutAmount, 2) : '',
      rateCutAdjustsLabour: true,
      rateCutBookedRate: cleanRateCutFine > 0 ? cleanRateCutInfo.unitRate : 0,
      receivedPriceOverride: receiptHasFine(payload.receiptType) ? '' : payload.receivedPriceOverride,
      receivedValue: cleanTotals.receivedValue,
      subtotal,
    };
  }

  function showPreparedWebPdfShare(prepared: WebPdfShareFile) {
    setWebPdfShareFile(prepared);
    setSyncMessage(`${prepared.fileName} ready. iPhone me Share PDF dabao aur WhatsApp select karo.`);
  }

  async function shareWebBillPdf(payload: BillPayload, html: string, target: WebPdfShareTarget) {
    const prepared = await prepareBillPdfFileOnWeb(payload, html, target);
    if (!prepared) {
      return false;
    }

    try {
      if (await sharePreparedPdfFileOnWeb(prepared, false)) {
        setSyncMessage(`${prepared.fileName} ready to share.`);
        return true;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setSyncMessage('Share cancelled.');
        return true;
      }
    }

    showPreparedWebPdfShare(prepared);
    return true;
  }

  async function handlePreparedWebPdfShare() {
    if (!webPdfShareFile) {
      return;
    }

    try {
      if (await sharePreparedPdfFileOnWeb(webPdfShareFile, false)) {
        setSyncMessage(`${webPdfShareFile.fileName} ready to share.`);
        setWebPdfShareFile(null);
        return;
      }

      Alert.alert(
        'PDF share not available',
        'Is browser me PDF file share support nahi mil raha. Download PDF use karo ya iPhone Safari/PWA se try karo.',
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setSyncMessage('Share cancelled.');
        return;
      }
      const message = error instanceof Error ? error.message : 'Unable to open iPhone share sheet.';
      Alert.alert('Share failed', message);
    }
  }

  async function handlePreparedWebPdfDownload() {
    if (!webPdfShareFile) {
      return;
    }

    if (await downloadPreparedPdfOnWeb(webPdfShareFile)) {
      const action = shouldOpenWebPrintInsteadOfDownload() ? 'print/share opened' : 'downloaded';
      setSyncMessage(`${webPdfShareFile.fileName} ${action}.`);
      setWebPdfShareFile(null);
      return;
    }

    Alert.alert('PDF failed', 'Is browser me PDF print/download available nahi hai.');
  }

  async function sharePayload(payload: BillPayload, transactions: BillTransaction[] = []) {
    const html = buildBillHtml(payload, transactions);
    if (Platform.OS === 'web') {
      if (await shareWebBillPdf(payload, html, 'other')) {
        return;
      }
      if (await downloadBillPdfOnWeb(payload, html)) {
        setSyncMessage(`${safePdfFileName(payload)} downloaded.`);
        return;
      }
    }

    const uri = await createNamedNativePdf(payload, html);
    await shareNativePdfFile(uri, payload);
  }

  async function shareToCustomer(payload: BillPayload, transactions: BillTransaction[] = []) {
    const html = buildBillHtml(payload, transactions);
    if (Platform.OS === 'web') {
      if (await shareWebBillPdf(payload, html, 'customer')) {
        return;
      }
      if (await downloadBillPdfOnWeb(payload, html)) {
        setSyncMessage(`${safePdfFileName(payload)} downloaded.`);
      }
      return;
    }

    const uri = await createNamedNativePdf(payload, html);
    if (await sharePdfDirectlyToWhatsapp(uri, payload)) {
      setSyncMessage(`${safePdfFileName(payload)} ready for ${payload.customer.name || 'customer'}.`);
      return;
    }

    await shareNativePdfFile(uri, payload, `Share to ${payload.customer.name || 'customer'}`);
  }

  function shareSavedBillChoice(payload: BillPayload, target: 'customer' | 'other') {
    setSharePromptPayload(null);
    setSharePromptMessage('');
    const shareTask = target === 'customer' ? shareToCustomer(payload) : sharePayload(payload);
    void shareTask.catch((error) => {
      const message = error instanceof Error ? error.message : 'Unable to share bill.';
      Alert.alert('Share failed', message);
    });
  }

  async function handleSaveRates() {
    const gold = parseAmount(goldRate);
    const silver = parseAmount(silverRate);

    if (!rateDate.trim() || gold <= 0 || silver <= 0) {
      Alert.alert('Rates required', 'Gold and silver rates should be greater than 0.');
      return;
    }

    const cleanRateDate = dateInputToIso(rateDate);
    const updated = await upsertRate(db, {
      gold10gRate: gold,
      rateDate: cleanRateDate,
      silver1kgRate: silver,
    });
    setLatestRate(updated);
    setRateDate(cleanRateDate);
    const result = await runOnlineSync(false);
    setSyncMessage(result.ok ? 'Rates saved. Data updated online.' : 'Rates saved. Internet update pending.');
  }

  async function handleCreateItemName(name: string, material: MetalType) {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Item name required', 'Item name daalo.');
      return false;
    }

    try {
      await createItemName(db, cleanName, material);
      const result = await runOnlineSync(false);
      await refreshScreen();
      setSyncMessage(result.ok ? 'Item name saved. Data updated online.' : 'Item name saved. Internet update pending.');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Item name save nahi hua.';
      Alert.alert('Item name failed', message);
      return false;
    }
  }

  async function handleSaveParty(draft: CustomerDraft) {
    if (!draft.name.trim()) {
      Alert.alert('Party name required', 'Party ka naam daalo.');
      return false;
    }

    try {
      const savedParty = await saveCustomer(db, draft);
      const result = await runOnlineSync(false);
      await refreshScreen();
      setSyncMessage(result.ok ? 'Party saved. Data updated online.' : 'Party saved. Internet update pending.');
      return savedParty;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Party save nahi hui.';
      Alert.alert('Party failed', message);
      return false;
    }
  }

  async function handleSaveSupplier(draft: SupplierDraft) {
    if (!draft.name.trim()) {
      Alert.alert('Supplier name required', 'Supplier ka naam daalo.');
      return false;
    }

    try {
      const supplier = await saveSupplierManualEntry(db, { ...draft, entryDate: dateInputToIso(draft.entryDate) });
      setSupplierAccounts((current) => {
        const next = current.filter((entry) => entry.id !== supplier.id);
        return [supplier, ...next];
      });
      setSupplierLedgers((current) => {
        const next = current.filter((entry) => entry.supplierId !== supplier.id);
        return [
          {
            amountPaid: 0,
            amountPayable: supplier.openingAmountPayable,
            discountAmount: 0,
            finePayable: supplier.openingFinePayable,
            lastTransactionDate: supplier.entryDate || supplier.updatedAt,
            metalPaid: 0,
            openingAmountPayable: supplier.openingAmountPayable,
            openingFinePayable: supplier.openingFinePayable,
            purchaseAmount: 0,
            purchaseFine: 0,
            supplierId: supplier.id,
            transactionCount: 0,
          },
          ...next,
        ];
      });
      setSelectedSupplierId(null);
      setSelectedSupplierTransactions([]);
      setScreen('suppliers');
      setSyncMessage('Supplier saved locally. Updating list...');
      void (async () => {
        try {
          await refreshScreen();
          try {
            const result = await runOnlineSync(false);
            setSyncMessage(result.ok ? 'Supplier saved. Data updated online.' : 'Supplier saved. Internet update pending.');
          } catch {
            setSyncMessage('Supplier saved locally. Internet update pending.');
          }
        } catch {
          setSyncMessage('Supplier saved locally. Reopen suppliers to refresh list.');
        }
      })();
      return supplier;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Supplier save nahi hua.';
      Alert.alert('Supplier failed', message);
      return false;
    }
  }

  async function handleSaveSupplierTransaction(input: SupplierTransactionFormInput) {
    const supplier = selectedSupplier;
    if (!supplier) {
      Alert.alert('Supplier missing', 'Pehle supplier open karo.');
      return false;
    }

    const cashAmount = input.mode === 'cash_payment' || input.mode === 'split_payment' ? parseAmount(input.cashAmount) : 0;
    const bankAmount = input.mode === 'bank_payment' || input.mode === 'split_payment' ? parseAmount(input.bankAmount) : 0;
    const fineWeight = input.mode === 'purchase' || input.mode === 'metal_paid' ? parseAmount(input.fineWeight) : 0;
    const discountValue = input.mode === 'discount' ? parseAmount(input.discountAmount) : 0;

    if (cashAmount <= 0 && bankAmount <= 0 && fineWeight <= 0 && discountValue <= 0) {
      Alert.alert('Entry required', 'Cash, bank, metal ya discount me value daalo.');
      return false;
    }

    try {
      const transaction = await createSupplierTransaction(db, {
        bankAmount,
        bookedRate: input.mode === 'purchase' ? input.bookedRate : 0,
        cashAmount,
        discountAmount: discountValue,
        fineWeight,
        material: input.material,
        mode: input.mode,
        note: input.note,
        supplierId: supplier.id,
        transactionDate: dateInputToIso(input.transactionDate),
      });
      await refreshScreen();
      await loadSupplierTransactions(supplier.id);
      try {
        const result = await runOnlineSync(false);
        setSyncMessage(result.ok ? 'Supplier transaction saved. Data updated online.' : 'Supplier transaction saved. Internet update pending.');
      } catch {
        setSyncMessage('Supplier transaction saved locally. Internet update pending.');
      }
      return transaction;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Supplier transaction save nahi hua.';
      Alert.alert('Supplier transaction failed', message);
      return false;
    }
  }

  async function handleSaveCashBankEntry(input: {
    entryDate: string;
    mode: LedgerMode;
    particular: string;
    paymentAmount: string;
    receiptAmount: string;
  }) {
    try {
      await createCashBankEntry(db, {
        entryDate: dateInputToIso(input.entryDate),
        mode: input.mode,
        particular: input.particular,
        party: 'Manual',
        paymentAmount: input.paymentAmount,
        receiptAmount: input.receiptAmount,
      });
      await refreshScreen();
      try {
        const result = await runOnlineSync(false);
        setSyncMessage(result.ok ? 'Ledger entry saved. Data updated online.' : 'Ledger entry saved. Internet update pending.');
      } catch {
        setSyncMessage('Ledger entry saved locally. Internet update pending.');
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ledger entry save nahi hui.';
      Alert.alert('Ledger failed', message);
      return false;
    }
  }

  async function sharePartyVoucherPdf(party: PartyFolder, transaction: PartyTransaction) {
    let ledgerToUse = partyLedgerMap.get(party.customerId) ?? selectedPartyLedger;
    try {
      const asOf = transaction.createdAt || transaction.updatedAt || (transaction.transactionDate && /^\d{4}-\d{2}-\d{2}$/.test(transaction.transactionDate) ? `${transaction.transactionDate}T23:59:59` : transaction.transactionDate || localIsoDate());
      const snapshot = await getPartyLedgerSummaryAtDate(db, party.customerId, asOf);
      ledgerToUse = snapshot ?? ledgerToUse;
    } catch {
      // fallback to cached ledger
    }
    const html = buildPartyVoucherHtml(party, transaction, ledgerToUse);
    const title = voucherDocumentName(party, transaction);
    // minimal bill payload so exact PDF sizing matches voucher content
    const fakePayload = {
      billType: 'estimate' as any,
      billNo: transaction.voucherNo ? Number(transaction.voucherNo) : 0,
      billDate: transaction.transactionDate,
      pdfFrame: { width: 420, height: 520 },
      language: 'en' as any,
      customer: { name: party.customerName, mobile: party.customerMobile, address: party.customerAddress },
      items: [],
      subtotal: 0,
      autoRoundFigure: false,
      finalAmountOverride: '',
      receiptType: 'none',
      receiptMaterial: 'gold',
      receivedGrossWeight: '',
      receivedTouch: '',
      receivedFine: '',
      receivedCash: '',
      receivedPriceOverride: '',
      receivedValue: 0,
      rateCutFine: '',
      rateCutAmount: '',
      rateCutAdjustsLabour: false,
      rateCutBookedRate: 0,
      discountAmount: '',
      netTotal: 0,
    } as unknown as BillPayload;

    if (Platform.OS === 'web') {
      if (await printBillHtmlOnWeb(fakePayload, html)) {
        setSyncMessage(`${safeVoucherFileName(party, transaction)} print/share opened.`);
        return;
      }
      Alert.alert('Voucher PDF failed', 'Browser print/share available nahi hai.');
      return;
    }

    const size = pdfPrintSize(fakePayload);
    const exactHtml = withExactPdfPage(fakePayload, html, 'native-print');
    const { uri } = await Print.printToFileAsync({
      html: exactHtml,
      height: size.height,
      width: size.width,
      margins: { bottom: 0, left: 0, right: 0, top: 0 },
      textZoom: 100,
    });
    const ExpoFile = FileSystem.File as unknown as new (...uris: unknown[]) => ExpoFsFile;
    const sourceFile = new ExpoFile(uri);
    const targetFile = new ExpoFile(FileSystem.Paths.cache, safeVoucherFileName(party, transaction));
    if (targetFile.exists) {
      targetFile.delete();
    }
    sourceFile.copy(targetFile);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetFile.uri, {
        UTI: 'com.adobe.pdf',
        dialogTitle: `Share ${safeVoucherFileName(party, transaction)}`,
        mimeType: 'application/pdf',
      });
    } else {
      Alert.alert('Voucher ready', targetFile.uri);
    }
  }

  async function handleSavePartyTransaction(input: PartyTransactionFormInput) {
    const party = selectedPartyFolder;
    if (!party) {
      Alert.alert('Party missing', 'Pehle party open karo.');
      return false;
    }

    const cashAmount = input.mode === 'cash' || input.mode === 'split' ? parseAmount(input.cashAmount) : 0;
    const bankAmount = input.mode === 'bank' || input.mode === 'split' ? parseAmount(input.bankAmount) : 0;
    const fineWeight = input.mode === 'fine' ? parseAmount(input.fineWeight) : 0;
    const paymentAmount = input.mode === 'payment' ? parseAmount(input.paymentAmount) : 0;
    const discountValue = input.mode === 'discount' ? parseAmount(input.discountAmount) : 0;

    if (cashAmount <= 0 && bankAmount <= 0 && fineWeight <= 0 && paymentAmount <= 0 && discountValue <= 0) {
      Alert.alert('Entry required', 'Cash, bank, fine, payment ya discount me value daalo.');
      return false;
    }

    try {
      const transaction = await createPartyTransaction(db, {
        bankAmount,
        bookedRate: input.mode === 'fine' ? input.bookedRate : 0,
        cashAmount,
        customerId: party.customerId,
        discountAmount: discountValue,
        fineWeight,
        material: input.material,
        mode: input.mode,
        note: input.note,
        paymentAmount,
        transactionDate: dateInputToIso(input.transactionDate),
      });
      const result = await runOnlineSync(false);
      await refreshScreen();
      await loadPartyTransactions(party.customerId);
      setSyncMessage(result.ok ? 'Party transaction saved. Data updated online.' : 'Party transaction saved. Internet update pending.');
      return transaction;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Party transaction save nahi hua.';
      Alert.alert('Transaction failed', message);
      return false;
    }
  }

  async function handleSharePartyVoucher(transaction: PartyTransaction) {
    const party = selectedPartyFolder;
    if (!party) {
      Alert.alert('Party missing', 'Pehle party open karo.');
      return;
    }

    try {
      await sharePartyVoucherPdf(party, transaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Voucher PDF share nahi hua.';
      Alert.alert('Voucher failed', message);
    }
  }

  async function saveReminderForBill(savedBillId: string, payload: BillPayload) {
    const existingReminder = await getBillReminderForBill(db, savedBillId);
    if (!reminderEnabled) {
      if (existingReminder?.status === 'active') {
        await cancelScheduledReminderNotification(existingReminder.notificationId);
        await markBillReminderDone(db, existingReminder.id);
      }
      return null;
    }

    const reminder = await upsertBillReminder(db, {
      billId: savedBillId,
      billNo: payload.billNo,
      customerMobile: payload.customer.mobile,
      customerName: payload.customer.name,
      dueAt: buildDueAtFromBillDate(payload.billDate, reminderDays, reminderTime),
    });
    await cancelScheduledReminderNotification(existingReminder?.notificationId ?? '');
    const notificationId = await scheduleReminderNotification(reminder);
    if (notificationId) {
      await setBillReminderNotificationId(db, reminder.id, notificationId);
      return { ...reminder, notificationId };
    }
    return reminder;
  }

  async function handleSaveBill() {
    const cleanPayload = buildCleanPayload(billPayload);

    if (!cleanPayload.customer.name) {
      Alert.alert('Customer name required', 'Please enter or select party name.');
      return;
    }

    if (!cleanPayload.items.length) {
      Alert.alert('Item required', 'Please add at least one jewellery item.');
      return;
    }

    setIsSaving(true);
    try {
      const saveInput = {
        billDate: cleanPayload.billDate,
        billNo: cleanPayload.billNo,
        billType: cleanPayload.billType,
        customer: cleanPayload.customer,
        discountAmount: cleanPayload.discountAmount,
        items: cleanPayload.items,
        language: cleanPayload.language,
        netTotal: cleanPayload.netTotal,
        receiptMaterial: cleanPayload.receiptMaterial,
        receiptType: cleanPayload.receiptType,
        receivedCash: cleanPayload.receivedCash,
        receivedFine: cleanPayload.receivedFine,
        receivedGrossWeight: cleanPayload.receivedGrossWeight,
        receivedPriceOverride: cleanPayload.receivedPriceOverride,
        receivedTouch: cleanPayload.receivedTouch,
        receivedValue: cleanPayload.receivedValue,
        rateCutAmount: cleanPayload.rateCutAmount,
        rateCutAdjustsLabour: cleanPayload.rateCutAdjustsLabour,
        rateCutBookedRate: cleanPayload.rateCutBookedRate,
        rateCutFine: cleanPayload.rateCutFine,
      };
      const savedBill = editingBillId
        ? await updateBill(db, editingBillId, saveInput)
        : await createBill(db, saveInput);
      const savedPayload = (await getBillPayload(db, savedBill.id)) ?? cleanPayload;
      const savedReminder = await saveReminderForBill(savedBill.id, savedPayload);
      const bookStatusMessage =
        savedBill.entryStatus === 'pending'
          ? 'Book entry pending.'
          : 'Book entry already clear.';
      setLastSavedPayload(savedPayload);
      setLastSavedId(savedBill.id);
      setLastSavedEntryStatus(savedBill.entryStatus);
      setClearBookPeriod('custom');
      setClearCustomFrom(savedPayload.billDate);
      setClearCustomTo(savedPayload.billDate);
      const reminderMessage = savedReminder ? ` Reminder ${formatDateTime(savedReminder.dueAt)} set.` : '';
      setSyncMessage(`Bill ${savedPayload.billNo} ${editingBillId ? 'updated' : 'saved'}. ${bookStatusMessage}${reminderMessage}`);
      const syncResult = await runOnlineSync(false);
      resetBillDraft();
      setScreen('home');
      const saveMessage = `Bill ${savedPayload.billNo} ${editingBillId ? 'updated' : 'saved'}. ${bookStatusMessage}${reminderMessage} ${
        syncResult.ok ? 'Data updated online.' : 'Internet update pending.'
      }`;
      setSharePromptPayload(savedPayload);
      setSharePromptMessage(saveMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save bill.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSharePdf() {
    if (!lastSavedPayload || !lastSavedId) {
      Alert.alert('Save bill first', 'Please save this bill first, then share the saved PDF.');
      return;
    }

    try {
      const transactions = await getBillTransactions(db, lastSavedId);
      await sharePayload(lastSavedPayload, transactions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create PDF.';
      Alert.alert('PDF failed', message);
    }
  }

  async function handleShareSavedToCustomer() {
    if (!lastSavedPayload || !lastSavedId) {
      Alert.alert('Save bill first', 'Please save this bill first.');
      return;
    }

    try {
      const transactions = await getBillTransactions(db, lastSavedId);
      await shareToCustomer(lastSavedPayload, transactions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open WhatsApp.';
      Alert.alert('Share failed', message);
    }
  }

  async function handleShareExistingBill(id: string, target: 'customer' | 'other') {
    try {
      const payload = await getBillPayload(db, id);
      if (!payload) {
        Alert.alert('Bill missing', 'This saved bill could not be found.');
        return;
      }
      setLastSavedPayload(payload);
      setLastSavedId(id);
      const transactions = await getBillTransactions(db, id);
      if (target === 'customer') {
        await shareToCustomer(payload, transactions);
      } else {
        await sharePayload(payload, transactions);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to share bill.';
      Alert.alert('Share failed', message);
    }
  }

  async function handleOpenBill(id: string) {
    const [payload, transactions] = await Promise.all([getBillPayload(db, id), getBillTransactions(db, id)]);
    if (!payload) {
      Alert.alert('Bill missing', 'Saved bill nahi mila.');
      return;
    }

    setViewingBillId(id);
    setViewingBillPayload(payload);
    setViewingBillTransactions(transactions);
    setLastSavedPayload(payload);
    setBillViewBackScreen(screen === 'partyBills' ? 'partyBills' : screen === 'clearBooks' ? 'clearBooks' : 'bills');
    setScreen('billView');
  }

  async function handleSaveBillTransaction(input: BillTransactionFormInput) {
    if (!viewingBillId || !viewingBillPayload) {
      Alert.alert('Bill missing', 'Pehle saved bill open karo.');
      return;
    }

    const cashAmount = input.mode === 'cash' || input.mode === 'split' ? parseAmount(input.cashAmount) : 0;
    const bankAmount = input.mode === 'bank' || input.mode === 'split' ? parseAmount(input.bankAmount) : 0;
    const fineWeight = input.mode === 'fine' ? parseAmount(input.fineWeight) : 0;
    const rateCutFine = input.mode === 'rate_cut' ? parseAmount(input.rateCutFine) : 0;
    const rateCutAmount = input.mode === 'rate_cut' ? parseAmount(input.rateCutAmount) : 0;

    if (cashAmount <= 0 && bankAmount <= 0 && fineWeight <= 0 && rateCutFine <= 0 && rateCutAmount <= 0) {
      Alert.alert('Entry required', 'Cash, bank, fine ya rate-cut value me se kuch daalo.');
      return;
    }

    await createBillTransaction(db, {
      bankAmount,
      billId: viewingBillId,
      bookedRate: input.bookedRate,
      cashAmount,
      fineWeight,
      mode: input.mode,
      note: input.note,
      rateCutAmount,
      rateCutFine,
      transactionDate: dateInputToIso(input.transactionDate),
    });

    const syncResult = await runOnlineSync(false);
    const transactions = await getBillTransactions(db, viewingBillId);
    setViewingBillTransactions(transactions);
    setSyncMessage(
      syncResult.ok
        ? 'Bill transaction saved. Data updated online.'
        : 'Bill transaction saved. Internet update pending.',
    );
  }

  async function handleEditBill(id: string) {
    const payload = await getBillPayload(db, id);
    if (!payload) {
      Alert.alert('Bill missing', 'Saved bill nahi mila.');
      return;
    }

    setEditingBillId(id);
    setBillNo(payload.billNo);
    setBillDate(payload.billDate);
    setBillType(payload.billType);
    setLanguage(payload.language);
    setCustomer(payload.customer);
    const loadedItems = payload.items.length ? payload.items.map((item) => autoCalculateItem(item, rates)) : [emptyItem('gold')];
    setItems(loadedItems);
    setReceiptType(payload.receiptType);
    setReceiptMaterial(payload.receiptMaterial);
    setReceivedGrossWeight(payload.receivedGrossWeight);
    setReceivedTouch(payload.receivedTouch);
    setReceivedFine(payload.receivedFine);
    setReceivedCash(payload.receivedCash);
    setReceivedPriceOverride(payload.receivedPriceOverride);
    setRateCutFine(payload.rateCutFine);
    setRateCutAmount(payload.rateCutAmount);
    setRateCutAdjustsLabour(true);
    const cleanLoadedDiscountAmount = sanitizePayloadDiscountAmount(payload);
    setDiscountAmount(cleanLoadedDiscountAmount > 0 ? formatCalcValue(cleanLoadedDiscountAmount, 2) : '');
    setDiscountDirty(false);
    const exactNet = Math.max(payload.subtotal + parseAmount(payload.rateCutAmount) - payload.receivedValue - cleanLoadedDiscountAmount, 0);
    const inferredRoundFigure =
      !payload.autoRoundFigure &&
      !!payload.finalAmountOverride &&
      Math.abs(payload.netTotal - roundToTen(exactNet)) < 0.01 &&
      Math.abs(payload.netTotal - exactNet) > 0.01;
    const useRoundFigure = payload.autoRoundFigure || inferredRoundFigure;
    setAutoRoundFigure(useRoundFigure);
    setFinalAmountOverride(useRoundFigure ? '' : payload.finalAmountOverride);
    const reminder = await getBillReminderForBill(db, id);
    if (reminder?.status === 'active') {
      const parts = dueDateInputParts(payload.billDate, reminder.dueAt);
      setReminderEnabled(true);
      setReminderDays(parts.days);
      setReminderTime(parts.time);
    } else {
      setReminderEnabled(false);
      setReminderDays('3');
      setReminderTime('10:00');
    }
    setScreen('bill');
  }

  async function handleMarkEntered(id: string) {
    await markBillEntered(db, id);
    const result = await runOnlineSync(false);
    setSyncMessage(
      result.ok
        ? 'Book entry clear marked. Data updated online.'
        : 'Book entry clear marked. Internet update pending.',
    );
  }

  async function handleCreateBackup() {
    try {
      if (Platform.OS === 'web') {
        const result = await runOnlineSync(false);
        const message = result.ok
          ? 'Supabase backup complete. PWA data online saved.'
          : 'Supabase backup failed. Internet/Supabase pending.';
        setBackupMessage(message);
        Alert.alert(result.ok ? 'Supabase backup complete' : 'Backup pending', message);
        return;
      }

      const data = await getBackupData(db);
      const fileName = backupFileNameForToday();
      const json = JSON.stringify(data, null, 2);
      await writeBackupToAppFolder(fileName, json);

      setBackupMessage(`Backup saved in ${BACKUP_FOLDER_NAME}: ${fileName}`);
      Alert.alert('Backup created', `${BACKUP_FOLDER_NAME} folder ready.\nLatest file: ${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup failed.';
      setBackupMessage(message);
      Alert.alert('Backup failed', message);
    }
  }

  async function restoreBackupJson(json: string, sourceLabel: string) {
    let backupData: unknown;
    try {
      backupData = JSON.parse(json);
    } catch {
      throw new Error('Backup file valid JSON nahi hai.');
    }

    const result = await restoreBackupData(db, backupData);
    await refreshScreen();
    const syncResult = await runOnlineSync(false);
    const message = `${backupCountLine(result)} ${syncResult.ok ? 'Data updated online.' : 'Internet update pending.'}`;
    setBackupMessage(`${sourceLabel}: ${message}`);
    Alert.alert('Restore complete', message);
  }

  async function handleRestoreLatestBackup() {
    try {
      if (Platform.OS === 'web') {
        const result = await restoreFromSupabaseBackup(db);
        await refreshScreen();
        setBackupMessage(result.message);
        Alert.alert(result.ok ? 'Supabase restore complete' : 'Restore failed', result.message);
        return;
      }

      const latestBackup = await readLatestBackupFromAppFolder();
      if (!latestBackup) {
        Alert.alert('Backup not found', 'Pehle ek backup create karo, phir restore chalega.');
        return;
      }

      await restoreBackupJson(latestBackup.json, latestBackup.fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed.';
      setBackupMessage(message);
      Alert.alert('Restore failed', message);
    }
  }

  async function handleSync() {
    await runOnlineSync(true);
  }

  async function handleEnableNotifications() {
    const granted = await requestNotificationAccess();
    Alert.alert(granted ? 'Notifications enabled' : 'Notification access pending', granted ? 'Reminder notification access mil gaya.' : 'Device/browser ne notification allow nahi kiya.');
  }

  async function handleExtendReminder(reminder: BillReminder, days: number) {
    try {
      await cancelScheduledReminderNotification(reminder.notificationId);
      const updated = await extendBillReminder(db, reminder.id, days);
      const notificationId = await scheduleReminderNotification(updated);
      if (notificationId) {
        await setBillReminderNotificationId(db, updated.id, notificationId);
      }
      const result = await runOnlineSync(false);
      await refreshScreen();
      setSyncMessage(result.ok ? 'Reminder extended. Data updated online.' : 'Reminder extended. Internet update pending.');
    } catch (error) {
      Alert.alert('Reminder failed', error instanceof Error ? error.message : 'Reminder update nahi hua.');
    }
  }

  async function handleMarkReminderDone(reminder: BillReminder) {
    try {
      await cancelScheduledReminderNotification(reminder.notificationId);
      await markBillReminderDone(db, reminder.id);
      const result = await runOnlineSync(false);
      await refreshScreen();
      setSyncMessage(result.ok ? 'Reminder done marked. Data updated online.' : 'Reminder done marked. Internet update pending.');
    } catch (error) {
      Alert.alert('Reminder failed', error instanceof Error ? error.message : 'Reminder done nahi hua.');
    }
  }

  async function handleSaveMarketRun() {
    if (!marketDate.trim()) {
      Alert.alert('Date required', 'Market date daalo.');
      return;
    }

    try {
      const cleanMarketDate = dateInputToIso(marketDate);
      const existingRun = marketStockRows.find((row) => row.runDate === cleanMarketDate);
      await upsertMarketRun(db, {
        goldWeight: marketGoldWeight.trim() ? marketGoldWeight : existingRun?.goldWeight ?? 0,
        note: marketNote.trim() || existingRun?.note || '',
        runDate: cleanMarketDate,
        silverWeight: marketSilverWeight.trim() ? parseAmount(marketSilverWeight) * 1000 : existingRun?.silverWeight ?? 0,
      });
      const result = await runOnlineSync(false);
      await refreshScreen();
      setMarketGoldWeight('');
      setMarketSilverWeight('');
      setMarketNote('');
      setSyncMessage(result.ok ? 'Market stock saved. Data updated online.' : 'Market stock saved. Internet update pending.');
    } catch (error) {
      Alert.alert('Market stock failed', error instanceof Error ? error.message : 'Market stock save nahi hua.');
    }
  }

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <StatusBar style="dark" />
      {screen === 'home' ? (
        <NewHomeScreen
          allBills={allBills}
          backupMessage={backupMessage}
          billReminders={billReminders}
          goldRate={goldRate}
          language={language}
          marketStockRows={marketStockRows}
          onBackup={() => setScreen('backup')}
          onBills={() => setScreen('bills')}
          onClearBooks={() => setScreen('clearBooks')}
          onItemNames={() => setScreen('itemNames')}
          onMarketStock={() => setScreen('marketStock')}
          onNewBill={startBlankBill}
          onParties={() => setScreen('parties')}
          onRateEdit={() => setScreen('rates')}
          onReminders={() => setScreen('reminders')}
          onSuppliers={() => setScreen('suppliers')}
          onCashLedger={() => setScreen('cashLedger')}
          onBankLedger={() => setScreen('bankLedger')}
          partyLedgers={partyLedgers}
          silverRate={silverRate}
        />
      ) : null}
      {screen === 'rates' ? (
        <RatesScreen
          goldRate={goldRate}
          isSyncing={isSyncing}
          onBack={() => setScreen('home')}
          onGoldRateChange={setGoldRate}
          onRateDateChange={setRateDate}
          onSaveRates={handleSaveRates}
          onSilverRateChange={setSilverRate}
          onSync={handleSync}
          rateDate={rateDate}
          silverRate={silverRate}
          syncMessage={syncMessage}
        />
      ) : null}
      {screen === 'parties' ? (
        <PartiesScreen
          onBack={() => setScreen('home')}
          onAddParty={() => setScreen('addParty')}
          onOpenParty={(id) => void openParty(id)}
          partyFolders={partyFolders}
          partyLedgerMap={partyLedgerMap}
        />
      ) : null}
      {screen === 'addParty' ? (
        <AddPartyScreen
          onBack={() => setScreen('parties')}
          onSaveParty={handleSaveParty}
        />
      ) : null}
      {screen === 'partyBills' && selectedPartyFolder ? (
        <PartyBillsScreen
          bills={selectedPartyBills}
          onBack={() => setScreen('parties')}
          onCreateForParty={startPartyBill}
          onOpenBill={handleOpenBill}
          onOpenTransact={() => setScreen('partyTransact')}
          onShareBill={handleShareExistingBill}
          partyFolder={selectedPartyFolder}
          partyLedger={selectedPartyLedger}
          transactions={selectedPartyTransactions}
        />
      ) : null}
      {screen === 'partyTransact' && selectedPartyFolder ? (
        <PartyTransactScreen
          onBack={() => setScreen('partyBills')}
          onSavePartyTransaction={handleSavePartyTransaction}
          onShareVoucher={handleSharePartyVoucher}
          partyFolder={selectedPartyFolder}
          partyLedger={selectedPartyLedger}
          transactions={selectedPartyTransactions}
        />
      ) : null}
      {screen === 'suppliers' ? (
        selectedSupplier ? (
          <SupplierLedgerScreen
            ledger={selectedSupplierLedger}
            onBack={() => {
              setSelectedSupplierId(null);
              setSelectedSupplierTransactions([]);
            }}
            onOpenTransact={() => setScreen('supplierTransact')}
            supplier={selectedSupplier}
            transactions={selectedSupplierTransactions}
          />
        ) : (
          <SupplierListScreen
            ledgers={supplierLedgerMap}
            onAddSupplier={() => setScreen('addSupplier')}
            onBack={() => setScreen('home')}
            onOpenSupplier={(id) => void openSupplier(id)}
            suppliers={supplierAccounts}
          />
        )
      ) : null}
      {screen === 'addSupplier' ? (
        <SupplierAddScreen
          onBack={() => setScreen('suppliers')}
          onSaveSupplier={handleSaveSupplier}
        />
      ) : null}
      {screen === 'supplierTransact' && selectedSupplier ? (
        <SupplierEntryScreen
          ledger={selectedSupplierLedger}
          onBack={() => setScreen('suppliers')}
          onSaveSupplierTransaction={handleSaveSupplierTransaction}
          supplier={selectedSupplier}
          transactions={selectedSupplierTransactions}
        />
      ) : null}
      {screen === 'cashLedger' ? (
        <CashBankLedgerScreen
          allBills={allBills}
          billTransactions={allBillTransactions}
          cashBankEntries={cashBankEntries}
          ledgerType="cash"
          onBack={() => setScreen('home')}
          onSaveCashBankEntry={handleSaveCashBankEntry}
          partyFolders={partyFolders}
          partyTransactions={allPartyTransactions}
          supplierAccounts={supplierAccounts}
          supplierTransactions={allSupplierTransactions}
        />
      ) : null}
      {screen === 'bankLedger' ? (
        <CashBankLedgerScreen
          allBills={allBills}
          billTransactions={allBillTransactions}
          cashBankEntries={cashBankEntries}
          ledgerType="bank"
          onBack={() => setScreen('home')}
          onSaveCashBankEntry={handleSaveCashBankEntry}
          partyFolders={partyFolders}
          partyTransactions={allPartyTransactions}
          supplierAccounts={supplierAccounts}
          supplierTransactions={allSupplierTransactions}
        />
      ) : null}
      {screen === 'bills' ? (
        <BillsScreen
          billPeriod={billPeriod}
          bills={filteredBills}
          customFrom={customFrom}
          customTo={customTo}
          onBack={() => setScreen('home')}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onOpenBill={handleOpenBill}
          onPeriodChange={setBillPeriod}
          onShareBill={handleShareExistingBill}
        />
      ) : null}
      {screen === 'clearBooks' ? (
        <ClearBooksScreen
          billPeriod={clearBookPeriod}
          customFrom={clearCustomFrom}
          customTo={clearCustomTo}
          onBack={() => setScreen('home')}
          onCustomFromChange={setClearCustomFrom}
          onCustomToChange={setClearCustomTo}
          onOpenBill={handleOpenBill}
          onMarkEntered={handleMarkEntered}
          onPeriodChange={setClearBookPeriod}
          pendingBills={clearBookFilteredBills.filter((bill) => bill.entryStatus === 'pending')}
        />
      ) : null}
      {screen === 'backup' ? (
        <BackupScreen
          backupMessage={backupMessage}
          onBack={() => setScreen('home')}
          onCreateBackup={handleCreateBackup}
          onRestoreLatest={handleRestoreLatestBackup}
        />
      ) : null}
      {screen === 'reminders' ? (
        <RemindersScreen
          reminders={billReminders}
          onBack={() => setScreen('home')}
          onEnableNotifications={handleEnableNotifications}
          onExtendReminder={handleExtendReminder}
          onMarkDone={handleMarkReminderDone}
        />
      ) : null}
      {screen === 'marketStock' ? (
        <MarketStockScreen
          marketDate={marketDate}
          marketGoldWeight={marketGoldWeight}
          marketNote={marketNote}
          marketSilverWeight={marketSilverWeight}
          rows={marketStockRows}
          onBack={() => setScreen('home')}
          onDateChange={setMarketDate}
          onGoldWeightChange={setMarketGoldWeight}
          onNoteChange={setMarketNote}
          onSave={handleSaveMarketRun}
          onSilverWeightChange={setMarketSilverWeight}
        />
      ) : null}
      {screen === 'itemNames' ? (
        <ItemNamesScreen
          itemNames={itemNameOptions}
          onBack={() => setScreen('home')}
          onCreateItemName={handleCreateItemName}
        />
      ) : null}
      {screen === 'billView' && viewingBillPayload ? (
        <BillViewScreen
          billId={viewingBillId}
          payload={viewingBillPayload}
          transactions={viewingBillTransactions}
          onBack={() => setScreen(billViewBackScreen)}
          onEditBill={handleEditBill}
          onSaveTransaction={handleSaveBillTransaction}
          onShareCustomer={() => {
            if (viewingBillId) {
              void handleShareExistingBill(viewingBillId, 'customer');
            }
          }}
          onShareOther={() => {
            if (viewingBillId) {
              void handleShareExistingBill(viewingBillId, 'other');
            }
          }}
        />
      ) : null}
      {screen === 'bill' ? (
        <BillScreen
          billDate={billDate}
          billNo={billNo}
          autoRoundFigure={autoRoundFigure}
          billPayload={billPayload}
          customer={customer}
          discountAmount={discountAmount}
          discountInputValue={resolvedDiscountInput}
          draftItems={items}
          goldRate={goldRate}
          isSaving={isSaving}
          itemNameOptions={itemNameOptions}
          language={language}
          lastSavedPayload={lastSavedPayload}
          onAddItem={() => setItems((current) => [...current, emptyItem(current[current.length - 1]?.material ?? 'gold')])}
          onBack={() => setScreen('home')}
          onBillDateChange={setBillDate}
          onBillNoChange={(value) => setBillNo(Number(value) || 0)}
          onCustomerChange={updateCustomer}
          onAutoRoundFigureChange={updateAutoRoundFigure}
          onFinalAmountOverrideChange={updateFinalAmountOverride}
          onItemChange={updateItem}
          onCreateItemName={handleCreateItemName}
          onLanguageChange={setLanguage}
          onGoldRateChange={updateBillGoldRate}
          onReceiptCashChange={updateReceivedCash}
          onReceiptGrossWeightChange={updateReceivedGrossWeight}
          onReceiptMaterialChange={updateReceiptMaterial}
          onReceiptTouchChange={updateReceivedTouch}
          onReceiptTypeChange={updateReceiptType}
          onDiscountAmountChange={updateDiscountAmount}
          onRateCutAmountChange={updateRateCutAmount}
          onRateCutAdjustsLabourChange={setRateCutAdjustsLabour}
          onRateCutFineChange={updateRateCutFine}
          onRemoveItem={removeItem}
          onReminderDaysChange={setReminderDays}
          onReminderEnabledChange={setReminderEnabled}
          onReminderTimeChange={setReminderTime}
          onSaveBill={handleSaveBill}
          onSelectPartySuggestion={selectPartyForBill}
          onShareSaved={handleSharePdf}
          onShareSavedToCustomer={handleShareSavedToCustomer}
          onSilverRateChange={updateBillSilverRate}
          partyFolders={partyFolders}
          rates={rates}
          receiptMaterial={receiptMaterial}
          receiptType={receiptType}
          rateCutAmount={rateCutAmount}
          rateCutAdjustsLabour={rateCutAdjustsLabour}
          rateCutAutoAmount={rateCutAutoAmount}
          rateCutBookedLabel={rateCutBookedInfo.label}
          rateCutFine={rateCutFine}
          reminderDays={reminderDays}
          reminderEnabled={reminderEnabled}
          reminderTime={reminderTime}
          receivedCash={receivedCash}
          receivedFine={activeReceivedFine}
          finalAmountOverride={finalAmountOverride}
          receivedGrossWeight={receivedGrossWeight}
          receivedTouch={receivedTouch}
          silverRate={silverRate}
          totals={totals}
        />
      ) : null}
      <ShareChoicePrompt
        message={sharePromptMessage}
        onClose={() => {
          setSharePromptPayload(null);
          setSharePromptMessage('');
        }}
        onShareCustomer={(payload) => shareSavedBillChoice(payload, 'customer')}
        onShareOther={(payload) => shareSavedBillChoice(payload, 'other')}
        payload={sharePromptPayload}
      />
      <WebPdfSharePrompt
        prepared={webPdfShareFile}
        onClose={() => setWebPdfShareFile(null)}
        onDownload={handlePreparedWebPdfDownload}
        onShare={handlePreparedWebPdfShare}
      />
    <BottomNav current={screen} onNavigate={(s: any) => setScreen(s)} />
    </SafeAreaView>
  );
}

function WebPdfSharePrompt({
  onClose,
  onDownload,
  onShare,
  prepared,
}: {
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  prepared: WebPdfShareFile | null;
}) {
  const fallbackLabel = shouldOpenWebPrintInsteadOfDownload() ? 'Print PDF' : 'Download';

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={!!prepared}>
      <View style={styles.sharePromptOverlay}>
        <View style={styles.sharePromptCard}>
          <Text style={styles.sharePromptTitle}>PDF ready</Text>
          <Text style={styles.sharePromptText}>
            Bill PDF ready hai. Share dabao aur WhatsApp ya kisi bhi app me sirf PDF attach karke bhejo.
          </Text>
          {prepared ? (
            <Text style={styles.sharePromptMeta}>
              {prepared.fileName} | {prepared.payload.customer.mobile || 'No mobile'}
            </Text>
          ) : null}
          <View style={styles.sharePromptActions}>
            <Pressable onPress={onShare} style={[styles.sharePromptButton, styles.customerShareButton]}>
              <Text style={styles.sharePromptButtonText}>Share PDF</Text>
            </Pressable>
            <Pressable onPress={onDownload} style={styles.sharePromptButton}>
              <Text style={styles.sharePromptButtonText}>{fallbackLabel}</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} style={styles.sharePromptLater}>
            <Text style={styles.sharePromptLaterText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ShareChoicePrompt({
  message,
  onClose,
  onShareCustomer,
  onShareOther,
  payload,
}: {
  message: string;
  onClose: () => void;
  onShareCustomer: (payload: BillPayload) => void;
  onShareOther: (payload: BillPayload) => void;
  payload: BillPayload | null;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={!!payload}>
      <View style={styles.sharePromptOverlay}>
        <View style={styles.sharePromptCard}>
          <Text style={styles.sharePromptTitle}>Bill saved</Text>
          <Text style={styles.sharePromptText}>{message || 'Bill save ho gaya. Ab PDF share karna hai?'}</Text>
          {payload ? (
            <Text style={styles.sharePromptMeta}>
              Bill {payload.billNo} | {payload.customer.name || 'Customer'} | {formatMoney(payload.netTotal)}
            </Text>
          ) : null}
          <View style={styles.sharePromptActions}>
            <Pressable
              disabled={!payload}
              onPress={() => {
                if (payload) {
                  onShareCustomer(payload);
                }
              }}
              style={[styles.sharePromptButton, styles.customerShareButton]}
            >
              <Text style={styles.sharePromptButtonText}>Customer</Text>
            </Pressable>
            <Pressable
              disabled={!payload}
              onPress={() => {
                if (payload) {
                  onShareOther(payload);
                }
              }}
              style={styles.sharePromptButton}
            >
              <Text style={styles.sharePromptButtonText}>Other</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} style={styles.sharePromptLater}>
            <Text style={styles.sharePromptLaterText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function HomeScreen({
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
  const todayBills = allBills.filter((bill) => isBillInPeriod(bill.billDate, 'today', '', ''));
  const weekBills = allBills.filter((bill) => isBillInPeriod(bill.billDate, 'week', '', ''));
  const monthBills = allBills.filter((bill) => isBillInPeriod(bill.billDate, 'month', '', ''));
  const pendingBills = allBills.filter((bill) => bill.entryStatus === 'pending');
  const activeReminders = billReminders.filter((reminder) => reminder.status === 'active');
  const dueReminders = activeReminders.filter(reminderIsDue);
  const todayMarket = marketStockRows.find((row) => row.runDate === localIsoDate());
  const todayAmount = todayBills.reduce((sum, bill) => sum + bill.netTotal, 0);
  const monthAmount = monthBills.reduce((sum, bill) => sum + bill.netTotal, 0);
  const fineDue = partyLedgers.reduce((sum, ledger) => sum + ledger.fineBalance, 0);
  const labourDue = partyLedgers.reduce((sum, ledger) => sum + ledger.labourBalance, 0);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.homeHero}>
        <View style={styles.heroTop}>
          <View style={styles.heroBrand}>
            <BrandLogo size={36} />
            <View style={styles.heroCopy}>
              <Text style={styles.appTitle}>{SHOP.name}</Text>
              <Text style={styles.heroTitle}>{t(language, 'heroTitle')}</Text>
              <Text style={styles.heroSubtitle}>Rate cards tap karke aaj ka gold/silver rate update karo.</Text>
            </View>
          </View>
        </View>
        <View style={styles.rateTiles}>
          <Pressable onPress={onRateEdit} style={styles.rateTile}>
            <Text style={styles.rateLabel}>Gold</Text>
            <Text style={styles.rateValue}>{formatMoney(goldRate)}</Text>
            <Text style={styles.rateMetric}>10 gram | tap to edit</Text>
          </Pressable>
          <Pressable onPress={onRateEdit} style={[styles.rateTile, styles.silverRateTile]}>
            <Text style={styles.rateLabel}>Silver</Text>
            <Text style={styles.rateValue}>{formatMoney(silverRate)}</Text>
            <Text style={styles.rateMetric}>1 kg | tap to edit</Text>
          </Pressable>
        </View>
      </View>

      <Section title="Bills summary" />
      <View style={styles.summaryGrid}>
        <SummaryTile label="Today's bills" value={`${todayBills.length} | ${formatMoney(todayAmount)}`} />
        <SummaryTile label="Weekly bills" value={String(weekBills.length)} />
        <SummaryTile label="Monthly amount" value={formatMoney(monthAmount)} />
        <SummaryTile label="Books me clear baki" value={String(pendingBills.length)} />
        <SummaryTile label="Party fine due" value={gmText(fineDue)} />
        <SummaryTile label="Party amount due" value={formatMoney(labourDue)} />
        <SummaryTile label="Fine reminders" value={`${dueReminders.length} due | ${activeReminders.length} active`} />
        <SummaryTile
          label="Market balance"
          value={todayMarket ? `G ${gmText(todayMarket.goldRemaining)} | S ${kgTextFromGm(todayMarket.silverRemaining)}` : 'No stock today'}
        />
      </View>

      <Section title="Actions" />
      <View style={styles.homeActionGrid}>
        <Pressable onPress={onNewBill} style={[styles.homeActionButton, styles.primaryActionButton]}>
          <Text style={styles.homeActionTitle}>Create bill</Text>
          <Text style={styles.homeActionMeta}>Estimate bill book</Text>
        </Pressable>
        <Pressable onPress={onParties} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Parties</Text>
          <Text style={styles.homeActionMeta}>Party folders and bill history</Text>
        </Pressable>
        <Pressable onPress={onBills} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Bills</Text>
          <Text style={styles.homeActionMeta}>Today, week, month, custom</Text>
        </Pressable>
        <Pressable onPress={onClearBooks} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Bill to clear in books</Text>
          <Text style={styles.homeActionMeta}>{pendingBills.length} pending entries</Text>
        </Pressable>
        <Pressable onPress={onItemNames} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Item names</Text>
          <Text style={styles.homeActionMeta}>Create and select item names</Text>
        </Pressable>
        <Pressable onPress={onReminders} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Fine reminders</Text>
          <Text style={styles.homeActionMeta}>{dueReminders.length} due reminders</Text>
        </Pressable>
        <Pressable onPress={onSuppliers} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Suppliers</Text>
          <Text style={styles.homeActionMeta}>Purchase creditor ledger</Text>
        </Pressable>
        <Pressable onPress={onCashLedger} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Cash ledger</Text>
          <Text style={styles.homeActionMeta}>Day, week, month, year view</Text>
        </Pressable>
        <Pressable onPress={onBankLedger} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Bank ledger</Text>
          <Text style={styles.homeActionMeta}>Receipts and payments</Text>
        </Pressable>
        <Pressable onPress={onMarketStock} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Market stock</Text>
          <Text style={styles.homeActionMeta}>Daily carried vs bill sold</Text>
        </Pressable>
        <Pressable onPress={onBackup} style={styles.homeActionButton}>
          <Text style={styles.homeActionTitle}>Backup / restore</Text>
          <Text style={styles.homeActionMeta}>{backupMessage || 'Data backup and restore'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function OldHomeScreen({
  billPeriod,
  customFrom,
  customTo,
  filteredBills,
  goldRate,
  isSyncing,
  language,
  lastSavedPayload,
  latestRate,
  onCustomFromChange,
  onCustomToChange,
  onGoldRateChange,
  onMarkEntered,
  onNewBill,
  onPeriodChange,
  onRateDateChange,
  onSaveRates,
  onSelectParty,
  onShareBill,
  onShareSavedOther,
  onShareSavedToCustomer,
  onSilverRateChange,
  onSync,
  partyFolders,
  rateDate,
  recentBills,
  silverRate,
  syncMessage,
}: {
  billPeriod: BillPeriod;
  customFrom: string;
  customTo: string;
  filteredBills: RecentBill[];
  goldRate: string;
  isSyncing: boolean;
  language: Language;
  lastSavedPayload: BillPayload | null;
  latestRate: Rate | null;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onGoldRateChange: (value: string) => void;
  onMarkEntered: (id: string) => void;
  onNewBill: () => void;
  onPeriodChange: (value: BillPeriod) => void;
  onRateDateChange: (value: string) => void;
  onSaveRates: () => void;
  onSelectParty: (folder: PartyFolder) => void;
  onShareBill: (id: string, target: 'customer' | 'other') => void;
  onShareSavedOther: () => void;
  onShareSavedToCustomer: () => void;
  onSilverRateChange: (value: string) => void;
  onSync: () => void;
  partyFolders: PartyFolder[];
  rateDate: string;
  recentBills: RecentBill[];
  silverRate: string;
  syncMessage: string;
}) {
  const pendingBills = filteredBills.filter((bill) => bill.entryStatus === 'pending');
  const enteredBills = filteredBills.filter((bill) => bill.entryStatus === 'entered');
  const totalAmount = filteredBills.reduce((sum, bill) => sum + bill.netTotal, 0);
  const pendingAmount = pendingBills.reduce((sum, bill) => sum + bill.netTotal, 0);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <RateHero goldRate={goldRate} language={language} latestRate={latestRate} silverRate={silverRate} />

      <View style={styles.actionBar}>
        <Pressable onPress={onNewBill} style={styles.button}>
          <Text style={styles.buttonText}>New bill</Text>
        </Pressable>
        <Pressable disabled={isSyncing} onPress={onSync} style={[styles.button, styles.secondaryButton]}>
          <Text style={styles.secondaryButtonText}>{isSyncing ? 'Syncing...' : t(language, 'syncNow')}</Text>
        </Pressable>
      </View>
      <Text style={styles.syncMessage}>{syncMessage}</Text>

      {lastSavedPayload ? (
        <View style={styles.sharePanel}>
          <View style={styles.heroCopy}>
            <Text style={styles.sharePanelTitle}>Bill #{lastSavedPayload.billNo} saved</Text>
            <Text style={styles.sharePanelMeta}>
              {lastSavedPayload.customer.name || 'Customer'} | {formatMoney(lastSavedPayload.netTotal)}
            </Text>
          </View>
          <View style={styles.rowActions}>
            <Pressable onPress={onShareSavedToCustomer} style={[styles.smallButton, styles.customerShareButton]}>
              <Text style={styles.smallButtonText}>Customer</Text>
            </Pressable>
            <Pressable onPress={onShareSavedOther} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Other</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Section title="Rate update" />
      <View style={styles.panel}>
        <View style={styles.formGrid}>
          <DateField label={t(language, 'rateDate')} value={rateDate} onChangeText={onRateDateChange} />
          <Field keyboardType="numeric" label="Gold 10g" value={goldRate} onChangeText={onGoldRateChange} />
          <Field keyboardType="numeric" label="Silver 1kg" value={silverRate} onChangeText={onSilverRateChange} />
        </View>
        <Pressable onPress={onSaveRates} style={styles.button}>
          <Text style={styles.buttonText}>{t(language, 'saveRates')}</Text>
        </Pressable>
      </View>

      <Section title="Bills" />
      <View style={styles.panel}>
        <View style={styles.segmentBlock}>
          <Text style={styles.fieldLabel}>Bill period</Text>
          <BillPeriodSelector period={billPeriod} onChange={onPeriodChange} />
        </View>
        {billPeriod === 'custom' ? (
          <View style={[styles.formGrid, styles.customDateGrid]}>
              <DateField label="From" value={customFrom} onChangeText={onCustomFromChange} />
              <DateField label="To" value={customTo} onChangeText={onCustomToChange} />
          </View>
        ) : null}
        <View style={styles.summaryGrid}>
          <SummaryTile label="Bills" value={String(filteredBills.length)} />
          <SummaryTile label="Amount" value={formatMoney(totalAmount)} />
          <SummaryTile label="Pending entry" value={`${pendingBills.length} | ${formatMoney(pendingAmount)}`} />
          <SummaryTile label="Clear" value={String(enteredBills.length)} />
        </View>
      </View>
      <Text style={styles.sectionHelp}>Party folder bill save hote hi auto banega. Next bill ke liye folder select karo.</Text>
      <View style={styles.folderGrid}>
        {partyFolders.length ? (
          partyFolders.map((folder) => (
            <Pressable key={folder.customerId} onPress={() => onSelectParty(folder)} style={styles.folderCard}>
              <View style={styles.folderIcon}>
                <Text style={styles.folderIconText}>B</Text>
              </View>
              <View style={styles.folderBody}>
                <Text style={styles.folderName}>{folder.customerName}</Text>
                <Text style={styles.folderMeta}>
                  {folder.billCount} bills | Last {formatDateForBill(folder.lastBillDate)}
                </Text>
                <Text style={styles.folderMeta}>{folder.customerMobile || 'No mobile'}</Text>
              </View>
              <Text style={styles.folderAmount}>{formatMoney(folder.totalAmount)}</Text>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>No party folders yet. Create first bill to start folders.</Text>
          </View>
        )}
      </View>

      <Section title="Office pending entry" />
      <View style={styles.recentList}>
        {pendingBills.length ? (
          pendingBills.map((bill) => (
            <View key={bill.id} style={styles.pendingRow}>
              <View style={styles.pendingInfo}>
                <Text style={styles.recentBillNo}>#{bill.billNo} - {formatDateForBill(bill.billDate)}</Text>
                <Text style={styles.recentCustomer}>{bill.customerName || 'Customer'}</Text>
              </View>
              <Text style={styles.recentAmount}>{formatMoney(bill.netTotal)}</Text>
              <Pressable onPress={() => onMarkEntered(bill.id)} style={[styles.smallButton, styles.clearButton]}>
                <Text style={styles.smallButtonText}>Clear</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Selected period me pending office entry nahi hai.</Text>
        )}
      </View>

      <Section title={t(language, 'recentBills')} />
      <View style={styles.recentList}>
        {recentBills.length ? (
          recentBills.map((bill) => (
            <View key={bill.id} style={styles.recentRow}>
              <View>
                <Text style={styles.recentBillNo}>#{bill.billNo} - {formatDateForBill(bill.billDate)}</Text>
                <Text style={styles.recentCustomer}>{bill.customerName || 'Customer'}</Text>
              </View>
              <View style={styles.recentAmountBlock}>
                <Text style={styles.recentAmount}>{formatMoney(bill.netTotal)}</Text>
                <Text style={styles.recentSync}>{bill.entryStatus === 'entered' ? 'clear' : 'pending'} | {bill.syncStatus}</Text>
                <View style={styles.billActionRow}>
                  <Pressable onPress={() => void onShareBill(bill.id, 'customer')} style={[styles.billIconButton, styles.customerShareButton]}>
                    <Text style={styles.billIconButtonText}>Cus</Text>
                  </Pressable>
                  <Pressable onPress={() => void onShareBill(bill.id, 'other')} style={styles.billIconButton}>
                    <Text style={styles.billIconButtonText}>PDF</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No bills saved yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.topNav}>
      <Pressable onPress={onBack} style={[styles.button, styles.secondaryButton, styles.navButton]}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
      <Text numberOfLines={2} style={styles.screenTitle}>{title}</Text>
    </View>
  );
}

function RatesScreen({
  goldRate,
  isSyncing,
  onBack,
  onGoldRateChange,
  onRateDateChange,
  onSaveRates,
  onSilverRateChange,
  onSync,
  rateDate,
  silverRate,
  syncMessage,
}: {
  goldRate: string;
  isSyncing: boolean;
  onBack: () => void;
  onGoldRateChange: (value: string) => void;
  onRateDateChange: (value: string) => void;
  onSaveRates: () => void;
  onSilverRateChange: (value: string) => void;
  onSync: () => void;
  rateDate: string;
  silverRate: string;
  syncMessage: string;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Rate update" onBack={onBack} />
      <View style={styles.panel}>
        <View style={styles.formGrid}>
        <DateField label="Rate date" value={rateDate} onChangeText={onRateDateChange} />
          <Field keyboardType="numeric" label="Gold 10g" value={goldRate} onChangeText={onGoldRateChange} />
          <Field keyboardType="numeric" label="Silver 1kg" value={silverRate} onChangeText={onSilverRateChange} />
        </View>
        <View style={styles.actionBar}>
          <Pressable onPress={onSaveRates} style={styles.button}>
            <Text style={styles.buttonText}>Save rates</Text>
          </Pressable>
          <Pressable disabled={isSyncing} onPress={onSync} style={[styles.button, styles.secondaryButton]}>
            <Text style={styles.secondaryButtonText}>{isSyncing ? 'Updating...' : 'Update data'}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.syncMessage}>{syncMessage}</Text>
    </ScrollView>
  );
}

function BillPeriodFilter({
  billPeriod,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onPeriodChange,
}: {
  billPeriod: BillPeriod;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onPeriodChange: (value: BillPeriod) => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.fieldLabel}>Date filter</Text>
      <BillPeriodSelector period={billPeriod} onChange={onPeriodChange} />
      {billPeriod === 'custom' ? (
        <View style={[styles.formGrid, styles.customDateGrid]}>
          <DateField label="From" value={customFrom} onChangeText={onCustomFromChange} />
          <DateField label="To" value={customTo} onChangeText={onCustomToChange} />
        </View>
      ) : null}
    </View>
  );
}

function BillList({
  bills,
  emptyText,
  onOpenBill,
  onShareBill,
}: {
  bills: RecentBill[];
  emptyText: string;
  onOpenBill: (id: string) => void;
  onShareBill: (id: string, target: 'customer' | 'other') => void;
}) {
  return (
    <View style={styles.recentList}>
      {bills.length ? (
        bills.map((bill) => (
          <View key={bill.id} style={styles.recentRow}>
            <Pressable onPress={() => void onOpenBill(bill.id)} style={styles.billRowMain}>
              <Text style={styles.recentBillNo}>#{bill.billNo} - {formatDateForBill(bill.billDate)}</Text>
              <Text style={styles.recentCustomer}>{bill.customerName || 'Customer'}</Text>
              <Text style={styles.recentSync}>{bill.billType} | {bill.entryStatus === 'entered' ? 'clear' : 'pending'}</Text>
            </Pressable>
            <View style={styles.recentAmountBlock}>
              <Text style={styles.recentAmount}>{formatMoney(bill.netTotal)}</Text>
              <View style={styles.billActionRow}>
                <Pressable onPress={() => void onOpenBill(bill.id)} style={styles.billIconButton}>
                  <Text style={styles.billIconButtonText}>Open</Text>
                </Pressable>
                <Pressable onPress={() => void onShareBill(bill.id, 'customer')} style={[styles.billIconButton, styles.customerShareButton]}>
                  <Text style={styles.billIconButtonText}>Cus</Text>
                </Pressable>
                <Pressable onPress={() => void onShareBill(bill.id, 'other')} style={styles.billIconButton}>
                  <Text style={styles.billIconButtonText}>PDF</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </View>
  );
}

function PartiesScreen({
  onBack,
  onAddParty,
  onOpenParty,
  partyFolders,
  partyLedgerMap,
}: {
  onBack: () => void;
  onAddParty: () => void;
  onOpenParty: (id: string) => void;
  partyFolders: PartyFolder[];
  partyLedgerMap: Map<string, PartyLedgerSummary>;
}) {
  const [search, setSearch] = useState('');
  const filteredParties = useMemo(() => partyFolders.filter((folder) => partyMatchesSearch(folder, search)), [partyFolders, search]);
  const partyLedgers = [...partyLedgerMap.values()];
  const totalFineDue = partyLedgers.reduce((sum, ledger) => sum + ledger.fineBalance, 0);
  const totalAmountDue = partyLedgers.reduce((sum, ledger) => sum + ledger.labourBalance, 0);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Parties" onBack={onBack} />
      <View style={styles.stripSummary}>
        <SummaryTile label="Total fine due" value={`${formatCalcValue(totalFineDue, 3) || '0'} gm`} />
        <SummaryTile label="Total amount due" value={formatMoney(totalAmountDue)} />
      </View>
      <Pressable onPress={onAddParty} style={[styles.button, styles.addItemButton]}>
        <Text style={styles.buttonText}>Add party manually</Text>
      </Pressable>
      <Text style={styles.sectionHelp}>Party folder pe tap karo. Andar bills, party ledger aur transact action milega.</Text>
      <SearchBox placeholder="Search party, mobile, address" value={search} onChangeText={setSearch} />
      <View style={styles.folderGrid}>
        {filteredParties.length ? (
          filteredParties.map((folder) => (
            <Pressable key={folder.customerId} onPress={() => onOpenParty(folder.customerId)} style={styles.folderCard}>
              <View style={styles.folderIcon}>
                <Text style={styles.folderIconText}>P</Text>
              </View>
              <View style={styles.folderBody}>
                <Text style={styles.folderName}>{folder.customerName}</Text>
                <Text style={styles.folderMeta}>
                  {folder.billCount} bills | Last {formatDateForBill(folder.lastBillDate)}
                </Text>
                <Text style={styles.folderMeta}>{folder.customerMobile || 'No mobile'}</Text>
                <Text style={styles.folderMeta}>{folder.customerAddress || 'No address'}</Text>
                <PartyLedgerPills ledger={partyLedgerMap.get(folder.customerId)} />
              </View>
              <Text style={styles.folderAmount}>{formatMoney(partyLedgerMap.get(folder.customerId)?.labourBalance ?? folder.totalAmount)}</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>
            {partyFolders.length ? 'Search me party nahi mili.' : 'Abhi party folder nahi bana. Pehla bill save karte hi folder banega.'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function AddPartyScreen({
  onBack,
  onSaveParty,
}: {
  onBack: () => void;
  onSaveParty: (draft: CustomerDraft) => Promise<unknown>;
}) {
  const [partyName, setPartyName] = useState('');
  const [partyMobile, setPartyMobile] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [openingFine, setOpeningFine] = useState('');
  const [openingLabour, setOpeningLabour] = useState('');
  const [openingNote, setOpeningNote] = useState('');
  const [isSavingParty, setIsSavingParty] = useState(false);

  async function saveManualParty() {
    setIsSavingParty(true);
    try {
      const saved = await onSaveParty({
        address: partyAddress,
        mobile: partyMobile,
        name: partyName,
        openingFineBalance: openingFine,
        openingLabourBalance: openingLabour,
        openingNote,
      });
      if (saved) {
        setPartyName('');
        setPartyMobile('');
        setPartyAddress('');
        setOpeningFine('');
        setOpeningLabour('');
        setOpeningNote('');
        onBack();
      }
    } finally {
      setIsSavingParty(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Add party" onBack={onBack} />
      <View style={styles.accountHero}>
        <Text style={styles.accountHeroTitle}>Party opening ledger</Text>
        <Text style={styles.accountHeroMeta}>Yahan old baki fine/amount set karo. Future bills me current fine aur amount due automatically add hoga.</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Party details</Text>
        <View style={styles.formGrid}>
          <Field label="Party name" value={partyName} onChangeText={setPartyName} />
          <Field keyboardType="phone-pad" label="Mobile" value={partyMobile} onChangeText={setPartyMobile} />
          <Field label="Address" value={partyAddress} onChangeText={setPartyAddress} />
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Opening balance</Text>
        <View style={styles.formGrid}>
          <Field keyboardType="decimal-pad" label="Fine due opening (gm)" selectTextOnFocus value={openingFine} onChangeText={setOpeningFine} />
          <Field keyboardType="decimal-pad" label="Amount due opening" selectTextOnFocus value={openingLabour} onChangeText={setOpeningLabour} />
          <Field label="Opening narration" multiline value={openingNote} onChangeText={setOpeningNote} />
        </View>
        <View style={styles.stripSummary}>
          <SummaryTile label="Opening fine" value={`${formatCalcValue(parseAmount(openingFine), 3) || '0'} gm`} />
          <SummaryTile label="Opening amount" value={formatMoney(parseAmount(openingLabour))} />
        </View>
        <Pressable disabled={isSavingParty} onPress={() => void saveManualParty()} style={[styles.button, isSavingParty && styles.disabledButton]}>
          <Text style={styles.buttonText}>{isSavingParty ? 'Saving party...' : 'Save party'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function PartyBillsScreen({
  bills,
  onBack,
  onCreateForParty,
  onOpenBill,
  onOpenTransact,
  onShareBill,
  partyFolder,
  partyLedger,
  transactions,
}: {
  bills: RecentBill[];
  onBack: () => void;
  onCreateForParty: (folder: PartyFolder) => void;
  onOpenBill: (id: string) => void;
  onOpenTransact: () => void;
  onShareBill: (id: string, target: 'customer' | 'other') => void;
  partyFolder: PartyFolder;
  partyLedger: PartyLedgerSummary | null;
  transactions: PartyTransaction[];
}) {
  const [search, setSearch] = useState('');
  const filteredBills = useMemo(() => bills.filter((bill) => billMatchesSearch(bill, search)), [bills, search]);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Party bills" onBack={onBack} />
      <View style={[styles.folderCard, styles.activeFolderCard]}>
        <View style={styles.folderIcon}>
          <Text style={styles.folderIconText}>P</Text>
        </View>
        <View style={styles.folderBody}>
          <Text style={styles.folderName}>{partyFolder.customerName}</Text>
          <Text style={styles.folderMeta}>
            {partyFolder.billCount} bills | Last {formatDateForBill(partyFolder.lastBillDate)}
          </Text>
          <Text style={styles.folderMeta}>{partyFolder.customerMobile || 'No mobile'}</Text>
          <Text style={styles.folderMeta}>{partyFolder.customerAddress || 'No address'}</Text>
        </View>
        <Text style={styles.folderAmount}>{formatMoney(partyLedger?.labourBalance ?? partyFolder.totalAmount)}</Text>
      </View>
      {partyLedger ? (
        <>
          <Section title="Party ledger" />
          <View style={styles.summaryGrid}>
            <SummaryTile label="Fine given" value={`${formatCalcValue(partyLedger.fineGiven, 3) || '0'} gm`} />
            <SummaryTile label={ledgerFineLabel(partyLedger)} value={ledgerFineValue(partyLedger)} />
            <SummaryTile label="Amount due" value={formatMoney(partyLedger.labourBalance)} />
            <SummaryTile label="Received" value={formatMoney(partyLedger.amountReceived)} />
            {partyLedger.openingFineBalance > 0 ? <SummaryTile label="Opening fine" value={`${formatCalcValue(partyLedger.openingFineBalance, 3)} gm`} /> : null}
            {partyLedger.openingLabourBalance > 0 ? <SummaryTile label="Opening amount" value={formatMoney(partyLedger.openingLabourBalance)} /> : null}
            {partyLedger.rateCutAmount > 0 ? <SummaryTile label="Rate cut" value={formatMoney(partyLedger.rateCutAmount)} /> : null}
            {partyLedger.discountAmount > 0 ? <SummaryTile label="Discount" value={formatMoney(partyLedger.discountAmount)} /> : null}
          </View>
        </>
      ) : null}

      <View style={styles.actionBar}>
        <Pressable onPress={() => onCreateForParty(partyFolder)} style={styles.button}>
          <Text style={styles.buttonText}>New bill for party</Text>
        </Pressable>
        <Pressable onPress={onOpenTransact} style={[styles.button, styles.secondaryButton]}>
          <Text style={styles.secondaryButtonText}>Open party transact / receipt</Text>
        </Pressable>
      </View>

      <Section title="Party vouchers" />
      <View style={styles.recentList}>
        {transactions.length ? (
          transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionRow}>
              <View style={styles.billRowMain}>
                <Text style={styles.recentBillNo}>Voucher #{transaction.voucherNo} - {formatDateForBill(transaction.transactionDate)}</Text>
                <Text style={styles.recentCustomer}>{partyTransactionModeLabel(transaction.mode)}</Text>
                <Text style={styles.recentSync}>
                  {partyTransactionCashTotal(transaction) > 0 ? `Cash/bank ${formatMoney(partyTransactionCashTotal(transaction))} | ` : ''}
                  {transaction.fineWeight > 0 ? `Metal ${formatCalcValue(transaction.fineWeight, 3)} gm | ` : ''}
                  {transaction.paymentAmount > 0 ? `Payment ${formatMoney(transaction.paymentAmount)} | ` : ''}
                  {transaction.discountAmount > 0 ? `Dis ${formatMoney(transaction.discountAmount)} | ` : ''}
                  {transaction.note || 'No narration'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Abhi party voucher entry nahi hai.</Text>
        )}
      </View>

      <Section title={`${partyFolder.customerName} bills`} />
      <SearchBox placeholder="Search bill no, date, amount" value={search} onChangeText={setSearch} />
      <BillList bills={filteredBills} emptyText={bills.length ? 'Search me bill nahi mila.' : 'Is party ka bill nahi mila.'} onOpenBill={onOpenBill} onShareBill={onShareBill} />
    </ScrollView>
  );
}

function PartyTransactScreen({
  onBack,
  onSavePartyTransaction,
  onShareVoucher,
  partyFolder,
  partyLedger,
  transactions,
}: {
  onBack: () => void;
  onSavePartyTransaction: (input: PartyTransactionFormInput) => Promise<PartyTransaction | false>;
  onShareVoucher: (transaction: PartyTransaction) => void;
  partyFolder: PartyFolder;
  partyLedger: PartyLedgerSummary | null;
  transactions: PartyTransaction[];
}) {
  const [transactionDate, setTransactionDate] = useState(localIsoDate());
  const [transactionMode, setTransactionMode] = useState<PartyTransactionMode>('cash');
  const [transactionMaterial, setTransactionMaterial] = useState<MetalType>('silver');
  const [transactionCash, setTransactionCash] = useState('');
  const [transactionBank, setTransactionBank] = useState('');
  const [transactionFine, setTransactionFine] = useState('');
  const [transactionBookedRate, setTransactionBookedRate] = useState('');
  const [transactionPayment, setTransactionPayment] = useState('');
  const [transactionDiscount, setTransactionDiscount] = useState('');
  const [transactionNote, setTransactionNote] = useState('');
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const metalValue = useMemo(
    () => fineValueFromBookedRate(transactionMaterial, transactionFine, transactionBookedRate),
    [transactionBookedRate, transactionFine, transactionMaterial],
  );

  async function submitPartyTransaction() {
    setIsSavingTransaction(true);
    try {
      const saved = await onSavePartyTransaction({
        bankAmount: transactionBank,
        bookedRate: transactionBookedRate,
        cashAmount: transactionCash,
        discountAmount: transactionDiscount,
        fineWeight: transactionFine,
        material: transactionMaterial,
        mode: transactionMode,
        note: transactionNote,
        paymentAmount: transactionPayment,
        transactionDate,
      });
      if (saved) {
        setTransactionCash('');
        setTransactionBank('');
        setTransactionFine('');
        setTransactionPayment('');
        setTransactionDiscount('');
        setTransactionNote('');
        onShareVoucher(saved);
      }
    } finally {
      setIsSavingTransaction(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title={`${partyFolder.customerName} transact`} onBack={onBack} />
      <View style={styles.accountHero}>
        <Text style={styles.accountHeroTitle}>Party account receipt</Text>
        <Text style={styles.accountHeroMeta}>Cash/bank receive, fine receive, payment aur discount yahan se party ledger me post honge.</Text>
      </View>
      {partyLedger ? (
        <View style={styles.stripSummary}>
          <SummaryTile label={ledgerFineLabel(partyLedger)} value={ledgerFineValue(partyLedger)} />
          <SummaryTile label="Amount due" value={formatMoney(partyLedger.labourBalance)} />
        </View>
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>New transaction</Text>
        <View style={styles.segmentBlock}>
          <Text style={styles.fieldLabel}>Transaction type</Text>
          <Segment
            options={[
              { label: 'Cash rec', value: 'cash' },
              { label: 'Bank rec', value: 'bank' },
              { label: 'Split rec', value: 'split' },
              { label: 'Metal rec', value: 'fine' },
              { label: 'Payment', value: 'payment' },
              { label: 'Discount', value: 'discount' },
            ]}
            value={transactionMode}
            wrap
            onChange={setTransactionMode}
          />
        </View>
        <View style={styles.formGrid}>
          <DateField label="Date" value={transactionDate} onChangeText={setTransactionDate} />
          {transactionMode === 'cash' || transactionMode === 'split' ? (
            <Field keyboardType="decimal-pad" label="Cash received" selectTextOnFocus value={transactionCash} onChangeText={setTransactionCash} />
          ) : null}
          {transactionMode === 'bank' || transactionMode === 'split' ? (
            <Field keyboardType="decimal-pad" label="Bank received" selectTextOnFocus value={transactionBank} onChangeText={setTransactionBank} />
          ) : null}
          {transactionMode === 'payment' ? (
            <Field keyboardType="decimal-pad" label="Payment given" selectTextOnFocus value={transactionPayment} onChangeText={setTransactionPayment} />
          ) : null}
          {transactionMode === 'discount' ? (
            <Field keyboardType="decimal-pad" label="Discount" selectTextOnFocus value={transactionDiscount} onChangeText={setTransactionDiscount} />
          ) : null}
          {transactionMode === 'fine' ? (
            <>
              <View style={styles.segmentBlock}>
                <Text style={styles.fieldLabel}>Metal</Text>
                <MetalSelector material={transactionMaterial} onChange={setTransactionMaterial} />
              </View>
              <Field keyboardType="decimal-pad" label="Fine received (gm)" selectTextOnFocus value={transactionFine} onChangeText={setTransactionFine} />
              <Field
                keyboardType="decimal-pad"
                label={`Booked rate (${partyTransactionMetalRateLabel({ material: transactionMaterial })})`}
                selectTextOnFocus
                value={transactionBookedRate}
                onChangeText={setTransactionBookedRate}
              />
              <Field editable={false} label="Metal amount equivalent" value={metalValue > 0 ? formatBillMoney(metalValue) : ''} onChangeText={() => {}} />
            </>
          ) : null}
          <Field label="Narration" multiline value={transactionNote} onChangeText={setTransactionNote} />
        </View>
        <Pressable disabled={isSavingTransaction} onPress={submitPartyTransaction} style={[styles.button, isSavingTransaction && styles.disabledButton]}>
          <Text style={styles.buttonText}>{isSavingTransaction ? 'Saving transaction...' : 'Save transaction + receipt PDF'}</Text>
        </Pressable>
      </View>

      <Section title="Receipt vouchers" />
      <View style={styles.recentList}>
        {transactions.length ? (
          transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionRow}>
              <View style={styles.billRowMain}>
                <Text style={styles.recentBillNo}>Voucher #{transaction.voucherNo} - {formatDateForBill(transaction.transactionDate)}</Text>
                <Text style={styles.recentCustomer}>{partyTransactionModeLabel(transaction.mode)}</Text>
                <Text style={styles.recentSync}>
                  {partyTransactionCashTotal(transaction) > 0 ? `Cash/bank ${formatMoney(partyTransactionCashTotal(transaction))} | ` : ''}
                  {transaction.fineWeight > 0 ? `Metal ${formatCalcValue(transaction.fineWeight, 3)} gm | ` : ''}
                  {transaction.paymentAmount > 0 ? `Payment ${formatMoney(transaction.paymentAmount)} | ` : ''}
                  {transaction.discountAmount > 0 ? `Dis ${formatMoney(transaction.discountAmount)} | ` : ''}
                  {transaction.note || 'No narration'}
                </Text>
              </View>
              <Pressable onPress={() => void onShareVoucher(transaction)} style={styles.billIconButton}>
                <Text style={styles.billIconButtonText}>PDF</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Abhi receipt voucher nahi hai.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function supplierTransactionModeLabel(mode: SupplierTransactionMode) {
  switch (mode) {
    case 'cash_payment':
      return 'Cash paid';
    case 'bank_payment':
      return 'Bank paid';
    case 'split_payment':
      return 'Cash + bank paid';
    case 'metal_paid':
      return 'Metal paid';
    case 'discount':
      return 'Discount';
    default:
      return 'Purchase';
  }
}

function supplierMatchesSearch(supplier: SupplierAccount, ledger: SupplierLedgerSummary | undefined, query: string) {
  return includesSearch(
    [
      supplier.name,
      supplier.entryDate,
      supplier.mobile,
      supplier.address,
      ledger?.finePayable,
      ledger?.amountPayable,
      supplier.openingNote,
    ],
    query,
  );
}

function SuppliersScreen({
  ledgers,
  onAddSupplier,
  onBack,
  onOpenSupplier,
  suppliers,
}: {
  ledgers: Map<string, SupplierLedgerSummary>;
  onAddSupplier: () => void;
  onBack: () => void;
  onOpenSupplier: (supplierId: string) => void;
  suppliers: SupplierAccount[];
}) {
  const [search, setSearch] = useState('');
  const filteredSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplierMatchesSearch(supplier, ledgers.get(supplier.id), search)),
    [ledgers, search, suppliers],
  );
  const totalFinePayable = [...ledgers.values()].reduce((sum, ledger) => sum + ledger.finePayable, 0);
  const totalAmountPayable = [...ledgers.values()].reduce((sum, ledger) => sum + ledger.amountPayable, 0);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Suppliers" onBack={onBack} />
      <View style={styles.stripSummary}>
        <SummaryTile label="Fine payable" value={`${formatCalcValue(totalFinePayable, 3) || '0'} gm`} />
        <SummaryTile label="Amount payable" value={formatMoney(totalAmountPayable)} />
      </View>
      <Pressable onPress={onAddSupplier} style={styles.button}>
        <Text style={styles.buttonText}>Add supplier</Text>
      </Pressable>
      <SearchBox placeholder="Search supplier, mobile, address" value={search} onChangeText={setSearch} />
      <View style={styles.recentList}>
        {filteredSuppliers.length ? (
          filteredSuppliers.map((supplier) => {
            const ledger = ledgers.get(supplier.id);
            return (
              <Pressable key={supplier.id} onPress={() => onOpenSupplier(supplier.id)} style={styles.folderCard}>
                <View style={styles.folderIcon}>
                  <Text style={styles.folderIconText}>S</Text>
                </View>
                <View style={styles.billRowMain}>
                  <Text style={styles.folderName}>{supplier.name}</Text>
                  <Text style={styles.folderMeta}>Entry {formatDateForBill(supplier.entryDate)}</Text>
                  <Text style={styles.folderMeta}>{supplier.mobile || 'No mobile'}</Text>
                  <Text style={styles.folderMeta}>{supplier.address || 'No address'}</Text>
                </View>
                <View style={styles.folderAmountBlock}>
                  <Text style={styles.folderAmount}>{formatMoney(ledger?.amountPayable ?? supplier.openingAmountPayable)}</Text>
                  <Text style={styles.recentSync}>{formatCalcValue(ledger?.finePayable ?? supplier.openingFinePayable, 3) || '0'} gm</Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.emptyText}>{suppliers.length ? 'Search me supplier nahi mila.' : 'Abhi supplier account nahi hai.'}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function SupplierDetailScreen({
  ledger,
  onBack,
  onOpenTransact,
  supplier,
  transactions,
}: {
  ledger: SupplierLedgerSummary | null;
  onBack: () => void;
  onOpenTransact: () => void;
  supplier: SupplierAccount;
  transactions: SupplierTransaction[];
}) {
  const [search, setSearch] = useState('');
  const filteredTransactions = transactions.filter((transaction) =>
    includesSearch(
      [
        transaction.voucherNo,
        transaction.transactionDate,
        supplierTransactionModeLabel(transaction.mode),
        transaction.fineWeight,
        transaction.cashAmount,
        transaction.bankAmount,
        transaction.note,
      ],
      search,
    ),
  );

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Supplier ledger" onBack={onBack} />
      <View style={styles.partyHeaderCard}>
        <View style={styles.folderIcon}>
          <Text style={styles.folderIconText}>S</Text>
        </View>
        <View style={styles.billRowMain}>
          <Text style={styles.folderName}>{supplier.name}</Text>
          <Text style={styles.folderMeta}>Entry {formatDateForBill(supplier.entryDate)}</Text>
          <Text style={styles.folderMeta}>{supplier.mobile || 'No mobile'}</Text>
          <Text style={styles.folderMeta}>{supplier.address || 'No address'}</Text>
        </View>
      </View>
      <View style={styles.stripSummary}>
        <SummaryTile label="Fine payable" value={`${formatCalcValue(ledger?.finePayable ?? supplier.openingFinePayable, 3) || '0'} gm`} />
        <SummaryTile label="Amount payable" value={formatMoney(ledger?.amountPayable ?? supplier.openingAmountPayable)} />
        <SummaryTile label="Paid" value={formatMoney(ledger?.amountPaid ?? 0)} />
      </View>
      <Pressable onPress={onOpenTransact} style={styles.button}>
        <Text style={styles.buttonText}>Transact / pay supplier</Text>
      </Pressable>
      <SearchBox placeholder="Search voucher, date, amount" value={search} onChangeText={setSearch} />
      <View style={styles.recentList}>
        {filteredTransactions.length ? (
          filteredTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionRow}>
              <View style={styles.billRowMain}>
                <Text style={styles.recentBillNo}>Voucher #{transaction.voucherNo} - {formatDateForBill(transaction.transactionDate)}</Text>
                <Text style={styles.recentCustomer}>{supplierTransactionModeLabel(transaction.mode)}</Text>
                <Text style={styles.recentSync}>
                  {transaction.fineWeight > 0 ? `${formatCalcValue(transaction.fineWeight, 3)} gm | ` : ''}
                  {transaction.cashAmount + transaction.bankAmount > 0 ? `${formatMoney(transaction.cashAmount + transaction.bankAmount)} | ` : ''}
                  {transaction.discountAmount > 0 ? `Dis ${formatMoney(transaction.discountAmount)} | ` : ''}
                  {transaction.note || 'No narration'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{transactions.length ? 'Search me transaction nahi mila.' : 'Abhi supplier transaction nahi hai.'}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function SupplierTransactScreen({
  ledger,
  onBack,
  onSaveSupplierTransaction,
  supplier,
  transactions,
}: {
  ledger: SupplierLedgerSummary | null;
  onBack: () => void;
  onSaveSupplierTransaction: (input: SupplierTransactionFormInput) => Promise<SupplierTransaction | false>;
  supplier: SupplierAccount;
  transactions: SupplierTransaction[];
}) {
  const [transactionDate, setTransactionDate] = useState(localIsoDate());
  const [mode, setMode] = useState<SupplierTransactionMode>('purchase');
  const [material, setMaterial] = useState<MetalType>('silver');
  const [fineWeight, setFineWeight] = useState('');
  const [bookedRate, setBookedRate] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const metalValue = useMemo(() => fineValueFromBookedRate(material, fineWeight, bookedRate), [bookedRate, fineWeight, material]);

  async function submitTransaction() {
    setIsSavingTransaction(true);
    try {
      const saved = await onSaveSupplierTransaction({
        bankAmount,
        bookedRate,
        cashAmount,
        discountAmount,
        fineWeight,
        material,
        mode,
        note,
        transactionDate,
      });
      if (saved) {
        setFineWeight('');
        setBookedRate('');
        setCashAmount('');
        setBankAmount('');
        setDiscountAmount('');
        setNote('');
      }
    } finally {
      setIsSavingTransaction(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title={`${supplier.name} transact`} onBack={onBack} />
      <View style={styles.stripSummary}>
        <SummaryTile label="Fine payable" value={`${formatCalcValue(ledger?.finePayable ?? supplier.openingFinePayable, 3) || '0'} gm`} />
        <SummaryTile label="Amount payable" value={formatMoney(ledger?.amountPayable ?? supplier.openingAmountPayable)} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>New supplier entry</Text>
        <View style={styles.segmentBlock}>
          <Text style={styles.fieldLabel}>Entry type</Text>
          <Segment
            options={[
              { label: 'Purchase', value: 'purchase' },
              { label: 'Cash paid', value: 'cash_payment' },
              { label: 'Bank paid', value: 'bank_payment' },
              { label: 'Split paid', value: 'split_payment' },
              { label: 'Metal paid', value: 'metal_paid' },
              { label: 'Discount', value: 'discount' },
            ]}
            value={mode}
            wrap
            onChange={setMode}
          />
        </View>
        <View style={styles.formGrid}>
          <DateField label="Date" value={transactionDate} onChangeText={setTransactionDate} />
          {mode === 'purchase' || mode === 'metal_paid' ? (
            <>
              <View style={styles.segmentBlock}>
                <Text style={styles.fieldLabel}>Metal</Text>
                <MetalSelector material={material} onChange={setMaterial} />
              </View>
              <Field keyboardType="decimal-pad" label={mode === 'purchase' ? 'Purchase fine (gm)' : 'Metal paid (gm)'} selectTextOnFocus value={fineWeight} onChangeText={setFineWeight} />
            </>
          ) : null}
          {mode === 'purchase' ? (
            <>
              <Field keyboardType="decimal-pad" label={`Booked rate (${partyTransactionMetalRateLabel({ material })})`} selectTextOnFocus value={bookedRate} onChangeText={setBookedRate} />
              <Field editable={false} label="Purchase amount equivalent" value={metalValue > 0 ? formatBillMoney(metalValue) : ''} onChangeText={() => {}} />
            </>
          ) : null}
          {mode === 'cash_payment' || mode === 'split_payment' ? (
            <Field keyboardType="decimal-pad" label="Cash paid" selectTextOnFocus value={cashAmount} onChangeText={setCashAmount} />
          ) : null}
          {mode === 'bank_payment' || mode === 'split_payment' ? (
            <Field keyboardType="decimal-pad" label="Bank paid" selectTextOnFocus value={bankAmount} onChangeText={setBankAmount} />
          ) : null}
          {mode === 'discount' ? (
            <Field keyboardType="decimal-pad" label="Discount" selectTextOnFocus value={discountAmount} onChangeText={setDiscountAmount} />
          ) : null}
          <Field label="Narration" multiline value={note} onChangeText={setNote} />
        </View>
        <Pressable disabled={isSavingTransaction} onPress={submitTransaction} style={[styles.button, isSavingTransaction && styles.disabledButton]}>
          <Text style={styles.buttonText}>{isSavingTransaction ? 'Saving entry...' : 'Save supplier entry'}</Text>
        </Pressable>
      </View>
      <Section title="Recent supplier vouchers" />
      <View style={styles.recentList}>
        {transactions.slice(0, 8).map((transaction) => (
          <View key={transaction.id} style={styles.transactionRow}>
            <View style={styles.billRowMain}>
              <Text style={styles.recentBillNo}>Voucher #{transaction.voucherNo} - {formatDateForBill(transaction.transactionDate)}</Text>
              <Text style={styles.recentCustomer}>{supplierTransactionModeLabel(transaction.mode)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function CashBankLedgerScreen({
  allBills,
  billTransactions,
  cashBankEntries,
  ledgerType,
  onBack,
  onSaveCashBankEntry,
  partyFolders,
  partyTransactions,
  supplierAccounts,
  supplierTransactions,
}: {
  allBills: RecentBill[];
  billTransactions: BillTransaction[];
  cashBankEntries: CashBankEntry[];
  ledgerType: 'cash' | 'bank';
  onBack: () => void;
  onSaveCashBankEntry: (input: {
    entryDate: string;
    mode: LedgerMode;
    particular: string;
    paymentAmount: string;
    receiptAmount: string;
  }) => Promise<boolean>;
  partyFolders: PartyFolder[];
  partyTransactions: PartyTransaction[];
  supplierAccounts: SupplierAccount[];
  supplierTransactions: SupplierTransaction[];
}) {
  const [period, setPeriod] = useState<LedgerPeriod>('today');
  const [customFrom, setCustomFrom] = useState(localIsoDate());
  const [customTo, setCustomTo] = useState(localIsoDate());
  const [openingBalance, setOpeningBalance] = useState('');
  const [manualDate, setManualDate] = useState(localIsoDate());
  const [manualParticular, setManualParticular] = useState('Opening balance');
  const [manualReceipt, setManualReceipt] = useState('');
  const [manualPayment, setManualPayment] = useState('');
  const [isSavingManualEntry, setIsSavingManualEntry] = useState(false);
  const [search, setSearch] = useState('');

  async function addManualLedgerEntry() {
    const receipt = parseAmount(manualReceipt);
    const payment = parseAmount(manualPayment);
    if (receipt <= 0 && payment <= 0) {
      Alert.alert('Entry required', 'Receipt ya payment amount daalo.');
      return;
    }
    setIsSavingManualEntry(true);
    try {
      const saved = await onSaveCashBankEntry({
        entryDate: manualDate || localIsoDate(),
        mode: ledgerType,
        particular: manualParticular.trim() || 'Manual ledger entry',
        paymentAmount: manualPayment,
        receiptAmount: manualReceipt,
      });
      if (saved) {
        setManualParticular('Manual ledger entry');
        setManualReceipt('');
        setManualPayment('');
      }
    } finally {
      setIsSavingManualEntry(false);
    }
  }

  const allEntries = useMemo(
    () => [
      ...cashBankEntries
        .filter((entry) => entry.mode === ledgerType)
        .map((entry): CashBankLedgerEntry => ({
          date: entry.entryDate,
          id: entry.id,
          mode: entry.mode,
          particular: entry.particular,
          party: entry.party,
          payment: entry.paymentAmount,
          receipt: entry.receiptAmount,
        })),
      ...buildCashBankLedgerEntries(ledgerType, allBills, billTransactions, partyTransactions, partyFolders, supplierTransactions, supplierAccounts),
    ],
    [allBills, billTransactions, cashBankEntries, ledgerType, partyFolders, partyTransactions, supplierAccounts, supplierTransactions],
  );
  const periodEntries = useMemo(
    () => allEntries.filter((entry) => isLedgerInPeriod(entry.date, period, customFrom, customTo)),
    [allEntries, customFrom, customTo, period],
  );
  const filteredEntries = useMemo(
    () => periodEntries.filter((entry) => includesSearch([entry.date, formatDateForBill(entry.date), entry.party, entry.particular, entry.receipt, entry.payment], search)),
    [periodEntries, search],
  );
  const receiptTotal = filteredEntries.reduce((sum, entry) => sum + entry.receipt, 0);
  const paymentTotal = filteredEntries.reduce((sum, entry) => sum + entry.payment, 0);
  const closing = parseAmount(openingBalance) + receiptTotal - paymentTotal;
  const title = ledgerType === 'cash' ? 'Cash ledger' : 'Bank ledger';
  const ledgerRows = useMemo(() => {
    let runningBalance = parseAmount(openingBalance);
    return [...filteredEntries]
      .sort((a, b) => `${a.date}-${a.id}`.localeCompare(`${b.date}-${b.id}`))
      .map((entry) => {
        runningBalance += entry.receipt - entry.payment;
        return { ...entry, balance: runningBalance };
      });
  }, [filteredEntries, openingBalance]);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title={title} onBack={onBack} />
      <View style={styles.accountHero}>
        <Text style={styles.accountHeroTitle}>{title}</Text>
        <Text style={styles.accountHeroMeta}>Receipts aur payments day/week/month/year/custom view me. Opening balance manual set karo, closing automatic dikhega.</Text>
      </View>
      <View style={styles.panel}>
        <View style={styles.segmentBlock}>
          <Text style={styles.fieldLabel}>Ledger period</Text>
          <LedgerPeriodSelector period={period} onChange={setPeriod} />
        </View>
        {period === 'custom' ? (
          <View style={styles.formGrid}>
            <DateField label="From" value={customFrom} onChangeText={setCustomFrom} />
            <DateField label="To" value={customTo} onChangeText={setCustomTo} />
          </View>
        ) : null}
        <View style={styles.formGrid}>
          <Field keyboardType="decimal-pad" label="Opening balance" selectTextOnFocus value={openingBalance} onChangeText={setOpeningBalance} />
        </View>
        <View style={styles.panelNested}>
          <Text style={styles.panelTitle}>Add opening / manual entry</Text>
          <View style={styles.formGrid}>
            <DateField label="Date" value={manualDate} onChangeText={setManualDate} />
            <Field label="Particular" value={manualParticular} onChangeText={setManualParticular} />
            <Field keyboardType="decimal-pad" label="Receipt" selectTextOnFocus value={manualReceipt} onChangeText={setManualReceipt} />
            <Field keyboardType="decimal-pad" label="Payment" selectTextOnFocus value={manualPayment} onChangeText={setManualPayment} />
          </View>
          <Pressable disabled={isSavingManualEntry} onPress={() => void addManualLedgerEntry()} style={[styles.secondaryButton, isSavingManualEntry && styles.disabledButton]}>
            <Text style={styles.secondaryButtonText}>{isSavingManualEntry ? 'Saving entry...' : 'Add ledger entry'}</Text>
          </Pressable>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryTile label="Opening" value={formatMoney(parseAmount(openingBalance))} />
          <SummaryTile label="Receipt" value={formatMoney(receiptTotal)} />
          <SummaryTile label="Payment" value={formatMoney(paymentTotal)} />
          <SummaryTile label="Closing" value={formatMoney(closing)} />
        </View>
      </View>
      <SearchBox placeholder="Search ledger entry" value={search} onChangeText={setSearch} />
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.ledgerTableScroller}>
        <View style={styles.ledgerTable}>
          <View style={[styles.ledgerTableRow, styles.ledgerTableHeader]}>
            <Text style={[styles.ledgerTableCell, styles.ledgerDateCell]}>Date</Text>
            <Text style={[styles.ledgerTableCell, styles.ledgerParticularCell]}>Particular</Text>
            <Text style={styles.ledgerTableAmount}>Receipt</Text>
            <Text style={styles.ledgerTableAmount}>Payment</Text>
            <Text style={styles.ledgerTableAmount}>Balance</Text>
          </View>
          {ledgerRows.length ? (
            ledgerRows.map((entry) => (
              <View key={entry.id} style={styles.ledgerTableRow}>
                <Text style={[styles.ledgerTableCell, styles.ledgerDateCell]}>{formatDateForBill(entry.date)}</Text>
                <View style={styles.ledgerParticularCell}>
                  <Text style={styles.ledgerParticularText}>{entry.particular}</Text>
                  <Text style={styles.ledgerPartyText}>{entry.party}</Text>
                </View>
                <Text style={styles.ledgerTableAmount}>{entry.receipt > 0 ? formatMoney(entry.receipt) : '-'}</Text>
                <Text style={styles.ledgerTableAmount}>{entry.payment > 0 ? formatMoney(entry.payment) : '-'}</Text>
                <Text style={styles.ledgerTableAmount}>{formatMoney(entry.balance)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Selected period me {title.toLowerCase()} entry nahi hai.</Text>
          )}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

function BillsScreen({
  billPeriod,
  bills,
  customFrom,
  customTo,
  onBack,
  onCustomFromChange,
  onCustomToChange,
  onOpenBill,
  onPeriodChange,
  onShareBill,
}: {
  billPeriod: BillPeriod;
  bills: RecentBill[];
  customFrom: string;
  customTo: string;
  onBack: () => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onOpenBill: (id: string) => void;
  onPeriodChange: (value: BillPeriod) => void;
  onShareBill: (id: string, target: 'customer' | 'other') => void;
}) {
  const [search, setSearch] = useState('');
  const filteredBills = useMemo(() => bills.filter((bill) => billMatchesSearch(bill, search)), [bills, search]);
  const totalAmount = filteredBills.reduce((sum, bill) => sum + bill.netTotal, 0);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Bills" onBack={onBack} />
      <BillPeriodFilter
        billPeriod={billPeriod}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={onCustomFromChange}
        onCustomToChange={onCustomToChange}
        onPeriodChange={onPeriodChange}
      />
      <SearchBox placeholder="Search bill no, party, mobile, amount" value={search} onChangeText={setSearch} />
      <View style={styles.summaryGrid}>
        <SummaryTile label="Bills" value={String(filteredBills.length)} />
        <SummaryTile label="Amount" value={formatMoney(totalAmount)} />
      </View>
      <Section title={billPeriod === 'today' ? "Today's bills" : 'Filtered bills'} />
      <BillList
        bills={filteredBills}
        emptyText={bills.length ? 'Search me bill nahi mila.' : 'Selected date filter me bill nahi hai.'}
        onOpenBill={onOpenBill}
        onShareBill={onShareBill}
      />
    </ScrollView>
  );
}

function ClearBooksScreen({
  billPeriod,
  customFrom,
  customTo,
  onBack,
  onCustomFromChange,
  onCustomToChange,
  onOpenBill,
  onMarkEntered,
  onPeriodChange,
  pendingBills,
}: {
  billPeriod: BillPeriod;
  customFrom: string;
  customTo: string;
  onBack: () => void;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onOpenBill: (id: string) => void;
  onMarkEntered: (id: string) => void;
  onPeriodChange: (value: BillPeriod) => void;
  pendingBills: RecentBill[];
}) {
  const [search, setSearch] = useState('');
  const filteredPendingBills = useMemo(() => pendingBills.filter((bill) => billMatchesSearch(bill, search)), [pendingBills, search]);
  const pendingAmount = filteredPendingBills.reduce((sum, bill) => sum + bill.netTotal, 0);
  const todayPendingCount = filteredPendingBills.filter((bill) => bill.billDate === localIsoDate()).length;
  const oldestPendingBill = filteredPendingBills.reduce<RecentBill | null>((oldest, bill) => {
    if (!oldest) {
      return bill;
    }
    return parseBillDate(bill.billDate) < parseBillDate(oldest.billDate) ? bill : oldest;
  }, null);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Bill to clear in books" onBack={onBack} />
      <BillPeriodFilter
        billPeriod={billPeriod}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={onCustomFromChange}
        onCustomToChange={onCustomToChange}
        onPeriodChange={onPeriodChange}
      />
      <SearchBox placeholder="Search pending bill, party, amount" value={search} onChangeText={setSearch} />
      <View style={styles.summaryGrid}>
        <SummaryTile label="Pending" value={String(filteredPendingBills.length)} />
        <SummaryTile label="Amount" value={formatMoney(pendingAmount)} />
        <SummaryTile label="Today" value={String(todayPendingCount)} />
        <SummaryTile label="Oldest" value={oldestPendingBill ? `#${oldestPendingBill.billNo}` : '-'} />
      </View>
      {oldestPendingBill ? (
        <View style={styles.accountHero}>
          <Text style={styles.accountHeroTitle}>Next entry: #{oldestPendingBill.billNo} - {oldestPendingBill.customerName}</Text>
          <Text style={styles.accountHeroMeta}>
            {formatDateForBill(oldestPendingBill.billDate)} | {formatMoney(oldestPendingBill.netTotal)} | Clear dabate hi home summary se pending count kam hoga.
          </Text>
        </View>
      ) : null}
      <View style={styles.recentList}>
        {filteredPendingBills.length ? (
          filteredPendingBills.map((bill) => (
            <View key={bill.id} style={styles.pendingRow}>
              <Pressable onPress={() => void onOpenBill(bill.id)} style={styles.pendingInfo}>
                <Text style={styles.recentBillNo}>#{bill.billNo} - {formatDateForBill(bill.billDate)}</Text>
                <Text style={styles.recentCustomer}>{bill.customerName || 'Customer'}</Text>
              </Pressable>
              <Text style={styles.recentAmount}>{formatMoney(bill.netTotal)}</Text>
              <Pressable onPress={() => void onMarkEntered(bill.id)} style={[styles.smallButton, styles.clearButton]}>
                <Text style={styles.smallButtonText}>Clear</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            {pendingBills.length ? 'Search me pending bill nahi mila.' : 'Selected filter me pending bill nahi hai.'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function RemindersScreen({
  onBack,
  onEnableNotifications,
  onExtendReminder,
  onMarkDone,
  reminders,
}: {
  onBack: () => void;
  onEnableNotifications: () => void;
  onExtendReminder: (reminder: BillReminder, days: number) => void;
  onMarkDone: (reminder: BillReminder) => void;
  reminders: BillReminder[];
}) {
  const [search, setSearch] = useState('');
  const activeReminders = reminders.filter((reminder) => reminder.status === 'active');
  const dueReminders = activeReminders.filter(reminderIsDue);
  const filteredReminders = reminders.filter((reminder) =>
    includesSearch([reminder.billNo, reminder.customerName, reminder.customerMobile, reminder.status, formatDateTime(reminder.dueAt)], search),
  );

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Fine reminders" onBack={onBack} />
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Notification access</Text>
        <Text style={styles.sectionHelp}>
          Bill save karte waqt mohalt days/time set karo. Due hone par reminder list me aayega; native app me local notification schedule hoga.
        </Text>
        <Pressable onPress={onEnableNotifications} style={styles.button}>
          <Text style={styles.buttonText}>Enable notification access</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryTile label="Due now" value={String(dueReminders.length)} />
        <SummaryTile label="Active" value={String(activeReminders.length)} />
        <SummaryTile label="Done" value={String(reminders.length - activeReminders.length)} />
      </View>

      <SearchBox placeholder="Search party, bill no, mobile" value={search} onChangeText={setSearch} />
      <View style={styles.recentList}>
        {filteredReminders.length ? (
          filteredReminders.map((reminder) => {
            const due = reminderIsDue(reminder);
            return (
              <View key={reminder.id} style={[styles.recentRow, due && styles.dueReminderRow]}>
                <View style={styles.billRowMain}>
                  <Text style={styles.recentBillNo}>Bill #{reminder.billNo} - {reminder.customerName}</Text>
                  <Text style={styles.recentCustomer}>{reminder.customerMobile || 'No mobile'}</Text>
                  <Text style={styles.recentSync}>
                    Due {formatDateTime(reminder.dueAt)} | {reminder.status} | Extended {reminder.extendedCount}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => onExtendReminder(reminder, 1)} style={styles.smallButton}>
                    <Text style={styles.smallButtonText}>+1 day</Text>
                  </Pressable>
                  <Pressable onPress={() => onExtendReminder(reminder, 7)} style={styles.smallButton}>
                    <Text style={styles.smallButtonText}>+7 days</Text>
                  </Pressable>
                  <Pressable onPress={() => onMarkDone(reminder)} style={[styles.smallButton, styles.clearButton]}>
                    <Text style={styles.smallButtonText}>Fine received</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>{reminders.length ? 'Search me reminder nahi mila.' : 'Abhi fine reminder nahi hai.'}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function MarketStockScreen({
  marketDate,
  marketGoldWeight,
  marketNote,
  marketSilverWeight,
  onBack,
  onDateChange,
  onGoldWeightChange,
  onNoteChange,
  onSave,
  onSilverWeightChange,
  rows,
}: {
  marketDate: string;
  marketGoldWeight: string;
  marketNote: string;
  marketSilverWeight: string;
  onBack: () => void;
  onDateChange: (value: string) => void;
  onGoldWeightChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
  onSilverWeightChange: (value: string) => void;
  rows: MarketStockSummary[];
}) {
  const [search, setSearch] = useState('');
  const selectedRow = rows.find((row) => row.runDate === marketDate);
  const filteredRows = rows.filter((row) =>
    includesSearch([row.runDate, formatDateForBill(row.runDate), row.note, row.billCount, row.goldRemaining, row.silverRemaining], search),
  );

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Market stock" onBack={onBack} />
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Aaj kitna maal leke nikle</Text>
        <Text style={styles.sectionHelp}>
          Silver ko kg me daalo. Bills bante hi us date ke sold weight se balance automatic less hota jayega.
        </Text>
        <View style={styles.formGrid}>
        <DateField label="Date" value={marketDate} onChangeText={onDateChange} />
          <Field keyboardType="decimal-pad" label="Gold carried (gm)" selectTextOnFocus value={marketGoldWeight} onChangeText={onGoldWeightChange} />
          <Field keyboardType="decimal-pad" label="Silver carried (kg)" selectTextOnFocus value={marketSilverWeight} onChangeText={onSilverWeightChange} />
          <Field label="Note" multiline value={marketNote} onChangeText={onNoteChange} />
        </View>
        {selectedRow ? (
          <Text style={styles.sectionHelp}>
            Saved: Gold {gmText(selectedRow.goldWeight)} | Silver {kgTextFromGm(selectedRow.silverWeight)}
          </Text>
        ) : null}
        <Pressable onPress={onSave} style={styles.button}>
          <Text style={styles.buttonText}>Save market stock</Text>
        </Pressable>
      </View>

      <Section title="Date wise balance" />
      <SearchBox placeholder="Search date or note" value={search} onChangeText={setSearch} />
      <View style={styles.recentList}>
        {filteredRows.length ? (
          filteredRows.map((row) => (
            <View key={row.id} style={styles.marketRow}>
              <View style={styles.billRowMain}>
                <Text style={styles.recentBillNo}>{formatDateForBill(row.runDate)}</Text>
                <Text style={styles.recentCustomer}>{row.note || `${row.billCount} bills created`}</Text>
              </View>
              <View style={styles.marketGrid}>
                <SummaryTile label="Gold taken" value={gmText(row.goldWeight)} />
                <SummaryTile label="Gold sold" value={gmText(row.goldSold)} />
                <SummaryTile label="Gold balance" value={gmText(row.goldRemaining)} />
                <SummaryTile label="Silver taken" value={kgTextFromGm(row.silverWeight)} />
                <SummaryTile label="Silver sold" value={kgTextFromGm(row.silverSold)} />
                <SummaryTile label="Silver balance" value={kgTextFromGm(row.silverRemaining)} />
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{rows.length ? 'Search me market entry nahi mili.' : 'Abhi market stock entry nahi hai.'}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function BackupScreen({
  backupMessage,
  onBack,
  onCreateBackup,
  onRestoreLatest,
}: {
  backupMessage: string;
  onBack: () => void;
  onCreateBackup: () => void;
  onRestoreLatest: () => void;
}) {
  const isPwaBackup = Platform.OS === 'web';
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <PageHeader title="Backup & restore" onBack={onBack} />
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Data safety</Text>
        <Text style={styles.sectionHelp}>
          {isPwaBackup
            ? 'iPhone/PWA backup Supabase par save hoga. Restore Supabase se latest online data fetch karega.'
            : 'First backup par app me BillBookBackups folder banega. Next backups automatic usi folder me jayenge. Restore latest backup usi folder ki latest file se data wapas laayega.'}
        </Text>
        <Pressable onPress={onCreateBackup} style={[styles.button, styles.addItemButton]}>
          <Text style={styles.buttonText}>{isPwaBackup ? 'Backup to Supabase' : 'Create backup'}</Text>
        </Pressable>
        <Pressable onPress={onRestoreLatest} style={[styles.button, styles.secondaryButton, styles.addItemButton]}>
          <Text style={styles.secondaryButtonText}>{isPwaBackup ? 'Restore from Supabase' : 'Restore latest backup'}</Text>
        </Pressable>
        <Text style={styles.syncMessage}>{backupMessage || 'Backup ready hone ke baad yahan status dikhega.'}</Text>
      </View>
    </ScrollView>
  );
}

function ItemNamesScreen({
  itemNames,
  onBack,
  onCreateItemName,
}: {
  itemNames: ItemNameOption[];
  onBack: () => void;
  onCreateItemName: (name: string, material: MetalType) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [material, setMaterial] = useState<MetalType>('gold');
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const filteredItemNames = useMemo(
    () => itemNames.filter((option) => includesSearch([option.name, option.material], search)),
    [itemNames, search],
  );

  async function saveItemName() {
    setIsSaving(true);
    try {
      const ok = await onCreateItemName(name, material);
      if (ok) {
        setName('');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <PageHeader title="Item names" onBack={onBack} />
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Create item name</Text>
        <View style={styles.formGrid}>
          <Field label="Item name" value={name} onChangeText={setName} />
          <View style={styles.segmentBlock}>
            <Text style={styles.fieldLabel}>Gold / Silver</Text>
            <MetalSelector material={material} onChange={setMaterial} />
          </View>
        </View>
        <Pressable disabled={isSaving} onPress={() => void saveItemName()} style={styles.button}>
          <Text style={styles.buttonText}>{isSaving ? 'Saving...' : 'Save item name'}</Text>
        </Pressable>
      </View>

      <Section title="Saved item names" />
      <SearchBox placeholder="Search item name" value={search} onChangeText={setSearch} />
      <View style={styles.itemNameList}>
        {filteredItemNames.length ? (
          filteredItemNames.map((option) => (
            <View key={`${option.id}-${option.material}`} style={styles.itemNameListRow}>
              <Text style={styles.itemNameListTitle}>{option.name}</Text>
              <Text style={styles.itemNameListMeta}>{option.material}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{itemNames.length ? 'Search me item nahi mila.' : 'Abhi item name save nahi hai.'}</Text>
        )}
      </View>
    </ScrollView>
  );
}

function BillViewScreen({
  billId,
  onBack,
  onEditBill,
  onSaveTransaction,
  onShareCustomer,
  onShareOther,
  payload,
  transactions,
}: {
  billId: string | null;
  onBack: () => void;
  onEditBill: (id: string) => void;
  onSaveTransaction: (input: BillTransactionFormInput) => Promise<void>;
  onShareCustomer: () => void;
  onShareOther: () => void;
  payload: BillPayload;
  transactions: BillTransaction[];
}) {
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [transactionMode, setTransactionMode] = useState<BillTransactionMode>('cash');
  const [transactionDate, setTransactionDate] = useState(localIsoDate());
  const [transactionCash, setTransactionCash] = useState('');
  const [transactionBank, setTransactionBank] = useState('');
  const [transactionFine, setTransactionFine] = useState('');
  const [transactionNote, setTransactionNote] = useState('');
  const [isTransactionSaving, setIsTransactionSaving] = useState(false);
  const transactionSummary = billTransactionSummary(payload, transactions);

  async function saveTransaction() {
    setIsTransactionSaving(true);
    try {
      await onSaveTransaction({
        bankAmount: transactionBank,
        bookedRate: 0,
        cashAmount: transactionCash,
        fineWeight: transactionFine,
        mode: transactionMode,
        note: transactionNote,
        rateCutAmount: '',
        rateCutFine: '',
        transactionDate,
      });
      setTransactionCash('');
      setTransactionBank('');
      setTransactionFine('');
      setTransactionNote('');
    } finally {
      setIsTransactionSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.topNav}>
        <Pressable onPress={onBack} style={[styles.button, styles.secondaryButton, styles.navButton]}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <View style={styles.viewTitleBlock}>
          <Text numberOfLines={2} style={styles.screenTitle}>{billDocumentName(payload)}</Text>
          <Text style={styles.viewSubTitle}>
            {payload.billType === 'wholesale' ? 'Professional invoice' : 'Estimate bill book'}
          </Text>
        </View>
        <Pressable onPress={() => setShowEditMenu((current) => !current)} style={styles.editIconButton}>
          <Text style={styles.editIconText}>Edit</Text>
        </Pressable>
      </View>

      {showEditMenu ? (
        <View style={styles.editMenu}>
          <Pressable
            disabled={!billId}
            onPress={() => {
              if (billId) {
                setShowEditMenu(false);
                void onEditBill(billId);
              }
            }}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>Pencil edit bill</Text>
          </Pressable>
          <Pressable onPress={onShareCustomer} style={[styles.smallButton, styles.customerShareButton]}>
            <Text style={styles.smallButtonText}>Share customer</Text>
          </Pressable>
          <Pressable onPress={onShareOther} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>Share PDF</Text>
          </Pressable>
        </View>
      ) : null}

      <BillPreviewFrame payload={payload} transactions={transactions} />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Post-bill transactions</Text>
        <View style={styles.totalGrid}>
          <TotalTile label="Fine total" value={`${formatCalcValue(transactionSummary.billFineGiven, 3)} gm`} />
          <TotalTile label="Fine cleared" value={`${formatCalcValue(transactionSummary.fineCleared, 3)} gm`} />
          <TotalTile
            highlight
            label={transactionSummary.billFineAdvance > 0 ? 'Fine advance' : 'Fine remain'}
            value={`${formatCalcValue(transactionSummary.billFineAdvance > 0 ? transactionSummary.billFineAdvance : transactionSummary.billFineBalance, 3)} gm`}
          />
          <TotalTile label="Cash/bank rec" value={formatBillMoney(transactionSummary.cashBankReceived, payload.autoRoundFigure)} />
          <TotalTile highlight label="Amount due" value={formatBillMoney(transactionSummary.billLabourBalance, payload.autoRoundFigure)} />
        </View>

        <View style={styles.segmentBlock}>
          <Text style={styles.fieldLabel}>Entry type</Text>
          <TransactionModeSelector mode={transactionMode} onChange={setTransactionMode} />
        </View>
        <View style={styles.formGrid}>
          <DateField label="Date" value={transactionDate} onChangeText={setTransactionDate} />
          {transactionMode === 'cash' || transactionMode === 'split' ? (
            <Field
              keyboardType="decimal-pad"
              label="Cash amount"
              selectTextOnFocus
              value={transactionCash}
              onChangeText={setTransactionCash}
            />
          ) : null}
          {transactionMode === 'bank' || transactionMode === 'split' ? (
            <Field
              keyboardType="decimal-pad"
              label="Bank amount"
              selectTextOnFocus
              value={transactionBank}
              onChangeText={setTransactionBank}
            />
          ) : null}
          {transactionMode === 'fine' ? (
            <Field
              keyboardType="decimal-pad"
              label="Fine received (gm)"
              selectTextOnFocus
              value={transactionFine}
              onChangeText={setTransactionFine}
            />
          ) : null}
          <Field label="Note" value={transactionNote} onChangeText={setTransactionNote} />
        </View>
        <Pressable
          disabled={!billId || isTransactionSaving}
          onPress={() => void saveTransaction()}
          style={[styles.button, (!billId || isTransactionSaving) && styles.disabledButton]}
        >
          <Text style={styles.buttonText}>{isTransactionSaving ? 'Saving...' : 'Save transaction'}</Text>
        </Pressable>

        <View style={styles.transactionList}>
          {transactions.length ? (
            transactions.map((transaction) => {
              const parts = [
                transaction.cashAmount > 0 ? `Cash ${formatBillMoney(transaction.cashAmount, payload.autoRoundFigure)}` : '',
                transaction.bankAmount > 0 ? `Bank ${formatBillMoney(transaction.bankAmount, payload.autoRoundFigure)}` : '',
                transaction.fineWeight > 0 ? `Fine ${formatCalcValue(transaction.fineWeight, 3)} gm` : '',
        transaction.rateCutFine > 0
          ? `Rate cut amount ${formatCalcValue(transaction.rateCutFine, 3)} gm = ${formatBillMoney(transaction.rateCutAmount, payload.autoRoundFigure)}`
                  : '',
              ].filter(Boolean);
              return (
                <View key={transaction.id} style={styles.transactionRow}>
                  <View style={styles.billRowMain}>
                    <Text style={styles.recentBillNo}>
                      {billTransactionModeLabel(transaction.mode)} - {formatDateForBill(transaction.transactionDate)}
                    </Text>
                    <Text style={styles.recentCustomer}>{parts.join(' | ') || 'No amount'}</Text>
                    {transaction.note ? <Text style={styles.recentSync}>{transaction.note}</Text> : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>Abhi post-bill transaction nahi hai.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function BillScreen({
  billDate,
  billNo,
  autoRoundFigure,
  billPayload,
  customer,
  discountAmount,
  discountInputValue,
  draftItems,
  goldRate,
  isSaving,
  itemNameOptions,
  language,
  lastSavedPayload,
  onAddItem,
  onBack,
  onBillDateChange,
  onBillNoChange,
  onAutoRoundFigureChange,
  onCustomerChange,
  onDiscountAmountChange,
  onFinalAmountOverrideChange,
  onCreateItemName,
  onItemChange,
  onLanguageChange,
  onGoldRateChange,
  onReceiptCashChange,
  onReceiptGrossWeightChange,
  onReceiptMaterialChange,
  onReceiptTouchChange,
  onReceiptTypeChange,
  onRateCutAmountChange,
  onRateCutAdjustsLabourChange,
  onRateCutFineChange,
  onRemoveItem,
  onReminderDaysChange,
  onReminderEnabledChange,
  onReminderTimeChange,
  onSaveBill,
  onSelectPartySuggestion,
  onShareSaved,
  onShareSavedToCustomer,
  onSilverRateChange,
  partyFolders,
  rates,
  receiptMaterial,
  receiptType,
  rateCutAmount,
  rateCutAdjustsLabour,
  rateCutAutoAmount,
  rateCutBookedLabel,
  rateCutFine,
  reminderDays,
  reminderEnabled,
  reminderTime,
  receivedCash,
  finalAmountOverride,
  receivedFine,
  receivedGrossWeight,
  receivedTouch,
  silverRate,
  totals,
}: {
  billDate: string;
  billNo: number;
  autoRoundFigure: boolean;
  billPayload: BillPayload;
  customer: CustomerDraft;
  discountAmount: string;
  discountInputValue: string;
  draftItems: BillItemDraft[];
  goldRate: string;
  isSaving: boolean;
  itemNameOptions: ItemNameOption[];
  language: Language;
  lastSavedPayload: BillPayload | null;
  onAddItem: () => void;
  onBack: () => void;
  onBillDateChange: (value: string) => void;
  onBillNoChange: (value: string) => void;
  onAutoRoundFigureChange: (value: boolean) => void;
  onCustomerChange: (key: keyof CustomerDraft, value: string) => void;
  onDiscountAmountChange: (value: string) => void;
  onFinalAmountOverrideChange: (value: string) => void;
  onCreateItemName: (name: string, material: MetalType) => Promise<boolean>;
  onItemChange: (index: number, key: keyof BillItemDraft, value: string) => void;
  onLanguageChange: (value: Language) => void;
  onGoldRateChange: (value: string) => void;
  onReceiptCashChange: (value: string) => void;
  onReceiptGrossWeightChange: (value: string) => void;
  onReceiptMaterialChange: (value: MetalType) => void;
  onReceiptTouchChange: (value: string) => void;
  onReceiptTypeChange: (value: ReceiptType) => void;
  onRateCutAmountChange: (value: string) => void;
  onRateCutAdjustsLabourChange: (value: boolean) => void;
  onRateCutFineChange: (value: string) => void;
  onRemoveItem: (index: number) => void;
  onReminderDaysChange: (value: string) => void;
  onReminderEnabledChange: (value: boolean) => void;
  onReminderTimeChange: (value: string) => void;
  onSaveBill: () => void;
  onSelectPartySuggestion: (folder: PartyFolder) => void;
  onShareSaved: () => void;
  onShareSavedToCustomer: () => void;
  onSilverRateChange: (value: string) => void;
  partyFolders: PartyFolder[];
  rates: MetalRates;
  receiptMaterial: MetalType;
  receiptType: ReceiptType;
  rateCutAmount: string;
  rateCutAdjustsLabour: boolean;
  rateCutAutoAmount: number;
  rateCutBookedLabel: string;
  rateCutFine: string;
  reminderDays: string;
  reminderEnabled: boolean;
  reminderTime: string;
  receivedCash: string;
  finalAmountOverride: string;
  receivedFine: string;
  receivedGrossWeight: string;
  receivedTouch: string;
  silverRate: string;
  totals: {
    autoNetTotal: number;
    baseLabourSubtotal: number;
    discountValue: number;
    finalAmountOverride: string;
    netTotal: number;
    rateCutValue: number;
    receivedValue: number;
    roundFigureEnabled: boolean;
    roundedNetTotal: number;
    subtotal: number;
  };
}) {
  const [hiddenPartySuggestionIds, setHiddenPartySuggestionIds] = useState<string[]>([]);
  const [collapsedItemIds, setCollapsedItemIds] = useState<string[]>([]);
  const partySuggestionQuery = customer.name.trim();
  const selectedPartyFolder = useMemo(
    () => (customer.id ? partyFolders.find((folder) => folder.customerId === customer.id) ?? null : null),
    [customer.id, partyFolders],
  );
  const partySuggestions = useMemo(
    () =>
      partySuggestionQuery
        ? partyFolders
            .filter((folder) => !hiddenPartySuggestionIds.includes(folder.customerId))
            .filter((folder) => folder.customerId !== customer.id)
            .filter((folder) => partyMatchesSearch(folder, partySuggestionQuery))
            .slice(0, 6)
        : [],
    [customer.id, hiddenPartySuggestionIds, partyFolders, partySuggestionQuery],
  );
  const effectiveRateCutAmount = rateCutAmount.trim() ? parseAmount(rateCutAmount) : rateCutAutoAmount;
  const hasRateCutFine = parseAmount(rateCutFine) > 0;
  const createBookedRateLines = rateSummaryLines(billPayload.items);
  const createFineTotal = calculateTotalFine(billPayload.items);
  const createLabourTotal = totals.baseLabourSubtotal;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.topNav}>
        <Pressable onPress={onBack} style={[styles.button, styles.secondaryButton, styles.navButton]}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={2} style={styles.screenTitle}>Create bill</Text>
      </View>

      <Section title="Transaction rates" />
      <View style={styles.panel}>
        <View style={styles.createTopRateStrip}>
          <View style={styles.createTopRateItem}>
            <Text style={styles.createTopRateLabel}>Gold / 10 gm</Text>
            <Text style={styles.createTopRateValue}>{formatBillMoney(goldRate, false)}</Text>
          </View>
          <View style={styles.createTopRateItem}>
            <Text style={styles.createTopRateLabel}>Silver / 1 kg</Text>
            <Text style={styles.createTopRateValue}>{formatBillMoney(silverRate, false)}</Text>
          </View>
        </View>
        <View style={styles.formGrid}>
          <Field keyboardType="numeric" label="Gold 10g for this bill" selectTextOnFocus value={goldRate} onChangeText={onGoldRateChange} />
          <Field keyboardType="numeric" label="Silver 1kg for this bill" selectTextOnFocus value={silverRate} onChangeText={onSilverRateChange} />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Bill setup</Text>
        <View style={styles.formGrid}>
          <Field label={t(language, 'billNo')} value={String(billNo)} onChangeText={onBillNoChange} />
        <DateField label={t(language, 'date')} value={billDate} onChangeText={onBillDateChange} />
        </View>
        <View style={styles.formGrid}>
          <View style={styles.segmentBlock}>
            <Text style={styles.fieldLabel}>{t(language, 'language')}</Text>
            <LanguageSelector language={language} onChange={onLanguageChange} />
          </View>
        </View>
      </View>

      <Section title="Party" />
      <View style={styles.panel}>
        <View style={styles.formGrid}>
          <Field label={t(language, 'name')} value={customer.name} onChangeText={(value) => onCustomerChange('name', value)} />
          <Field
            keyboardType="phone-pad"
            label={t(language, 'mobile')}
            value={customer.mobile}
            onChangeText={(value) => onCustomerChange('mobile', value)}
          />
          <Field
            label={t(language, 'address')}
            multiline
            value={customer.address}
            onChangeText={(value) => onCustomerChange('address', value)}
          />
        </View>
        {selectedPartyFolder ? (
          <View style={styles.selectedPartyBadge}>
            <Text style={styles.selectedPartyText}>Existing party: {selectedPartyFolder.customerName}</Text>
          </View>
        ) : null}
        {partySuggestions.length ? (
          <View style={styles.partySuggestionList}>
            {partySuggestions.map((folder) => (
              <View key={folder.customerId} style={styles.partySuggestionRow}>
                <Pressable
                  onPress={() => onSelectPartySuggestion(folder)}
                  style={styles.partySuggestionBody}
                >
                  <Text style={styles.partySuggestionName}>{folder.customerName}</Text>
                  <Text style={styles.partySuggestionMeta}>
                    {folder.billCount} bills | {folder.customerMobile || 'No mobile'} | {folder.customerAddress || 'No address'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setHiddenPartySuggestionIds((current) =>
                      current.includes(folder.customerId) ? current : [...current, folder.customerId],
                    )
                  }
                  style={styles.partySuggestionHide}
                >
                  <Text style={styles.partySuggestionHideText}>x</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Section title={t(language, 'items')} />
      {billPayload.items.map((item, index) => (
        collapsedItemIds.includes(item.id) ? (
          <Pressable
            key={item.id}
            onPress={() => setCollapsedItemIds((current) => current.filter((id) => id !== item.id))}
            style={styles.collapsedItemRow}
          >
            <Text style={styles.collapsedItemTitle}>- Item {index + 1}: {item.itemName || 'Blank item'}</Text>
            <Text style={styles.collapsedItemMeta}>
              {formatCalcValue(parseAmount(item.fine), 3) || '0'} gm fine | {formatBillMoney(item.amount, autoRoundFigure)}
            </Text>
          </Pressable>
        ) : (
          <ItemEditor
            index={index}
            item={item}
            itemNameOptions={itemNameOptions}
            key={item.id}
            language={language}
            rateInputValue={draftItems[index]?.rate ?? item.rate}
            autoRoundFigure={autoRoundFigure}
            onChange={onItemChange}
            onCreateItemName={onCreateItemName}
            onRemove={onRemoveItem}
            rates={rates}
            removable={billPayload.items.length > 1}
          />
        )
      ))}

      <Pressable
        onPress={() => {
          setCollapsedItemIds((current) => [...new Set([...current, ...billPayload.items.map((item) => item.id)])]);
          onAddItem();
        }}
        style={[styles.button, styles.secondaryButton, styles.addItemButton]}
      >
        <Text style={styles.secondaryButtonText}>{t(language, 'addItem')}</Text>
      </Pressable>

      <Section title="Fine / cash received" />
      <View style={styles.panel}>
        <ReceiptTypeSelector receiptType={receiptType} onChange={onReceiptTypeChange} />
        {receiptHasFine(receiptType) ? (
          <View style={styles.formGrid}>
            <View style={styles.segmentBlock}>
              <Text style={styles.fieldLabel}>Fine metal</Text>
              <MetalSelector material={receiptMaterial} onChange={onReceiptMaterialChange} />
            </View>
            <Field
              keyboardType="decimal-pad"
              label="Received GW (gm)"
              selectTextOnFocus
              value={receivedGrossWeight}
              onChangeText={onReceiptGrossWeightChange}
            />
            <Field keyboardType="decimal-pad" label="Touch %" selectTextOnFocus value={receivedTouch} onChangeText={onReceiptTouchChange} />
            <Field editable={false} label="Fine calculated (gm)" value={receivedFine || '0'} onChangeText={() => undefined} />
          </View>
        ) : null}
        {receiptHasCash(receiptType) ? (
          <Field keyboardType="decimal-pad" label="Cash received for labour" selectTextOnFocus value={receivedCash} onChangeText={onReceiptCashChange} />
        ) : null}
        <View style={styles.formGrid}>
          <Field
            keyboardType="decimal-pad"
            label="Rate cut fine less (gm)"
            selectTextOnFocus
            value={rateCutFine}
            onChangeText={onRateCutFineChange}
          />
          <Field
            keyboardType="decimal-pad"
            label="Rate cut amount"
            selectTextOnFocus
            value={rateCutAmount}
            onChangeText={onRateCutAmountChange}
          />
          <Field
            keyboardType="decimal-pad"
            label="Discount amount"
            selectTextOnFocus
            value={discountInputValue}
            onChangeText={onDiscountAmountChange}
          />
        </View>
        {hasRateCutFine ? (
          <View style={styles.compactHelpBlock}>
            <Text style={styles.sectionHelp}>
              Suggested by booked rate: {formatBillMoney(rateCutAutoAmount, false)} | {rateCutBookedLabel}
            </Text>
            {effectiveRateCutAmount > 0 ? (
              <Text style={styles.sectionHelp}>
                (Added in labour: {formatBillMoney(effectiveRateCutAmount, totals.roundFigureEnabled)})
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.formGrid}>
          <View style={styles.segmentBlock}>
            <Text style={styles.fieldLabel}>Auto round figure</Text>
            <RoundFigureSelector enabled={autoRoundFigure} onChange={onAutoRoundFigureChange} />
          </View>
          <Field
            keyboardType="decimal-pad"
            label="Final amount override"
            selectTextOnFocus
            value={finalAmountOverride}
            onChangeText={onFinalAmountOverrideChange}
          />
        </View>
        <View style={styles.totalGrid}>
          <TotalTile label="Base labour" value={formatBillMoney(totals.baseLabourSubtotal, totals.roundFigureEnabled)} />
          <TotalTile label="Amount received" value={formatBillMoney(totals.receivedValue, totals.roundFigureEnabled)} />
          {hasRateCutFine ? (
            <TotalTile label="Rate cut amount" value={formatBillMoney(totals.rateCutValue, totals.roundFigureEnabled)} />
          ) : null}
          {totals.discountValue > 0 ? (
            <TotalTile label="Discount" value={formatBillMoney(totals.discountValue, totals.roundFigureEnabled)} />
          ) : null}
          {totals.finalAmountOverride ? <TotalTile label="Auto net" value={formatBillMoney(totals.autoNetTotal)} /> : null}
          <TotalTile highlight label="Amount due" value={formatBillMoney(totals.netTotal, totals.roundFigureEnabled)} />
        </View>
        <View style={styles.createRateCutBaseBar}>
          <Text style={styles.createRateCutBaseTitle}>Rate cut base</Text>
          <View style={styles.createRateCutBaseGrid}>
            <Text style={styles.createRateCutBaseText}>Fine total: {formatCalcValue(createFineTotal, 3) || '0'} gm</Text>
            <Text style={styles.createRateCutBaseText}>
              Labour total: {formatBillMoney(createLabourTotal, totals.roundFigureEnabled)}
            </Text>
          </View>
          {createBookedRateLines.length ? (
            <View style={styles.createBookedRateList}>
              {createBookedRateLines.map((line) => (
                <Text key={line} style={styles.createBookedRateText}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <Section title="Fine reminder mohalt" />
      <View style={styles.panel}>
        <View style={styles.formGrid}>
          <View style={styles.segmentBlock}>
            <Text style={styles.fieldLabel}>Reminder</Text>
            <RoundFigureSelector enabled={reminderEnabled} onChange={onReminderEnabledChange} />
          </View>
          <Field
            keyboardType="number-pad"
            label="Mohlat days"
            selectTextOnFocus
            value={reminderDays}
            onChangeText={onReminderDaysChange}
          />
          <Field label="Reminder time" selectTextOnFocus value={reminderTime} onChangeText={onReminderTimeChange} />
        </View>
        <Text style={styles.sectionHelp}>
          Reminder due: {formatDateTime(buildDueAtFromBillDate(billDate, reminderDays, reminderTime))}
        </Text>
      </View>

      <View style={styles.actionBar}>
        <Pressable disabled={isSaving} onPress={onSaveBill} style={styles.button}>
          <Text style={styles.buttonText}>{isSaving ? 'Saving...' : t(language, 'saveBill')}</Text>
        </Pressable>
        <Pressable
          disabled={!lastSavedPayload}
          onPress={onShareSaved}
          style={[styles.button, styles.printButton, !lastSavedPayload && styles.disabledButton]}
        >
          <Text style={styles.buttonText}>Other share</Text>
        </Pressable>
        <Pressable
          disabled={!lastSavedPayload}
          onPress={onShareSavedToCustomer}
          style={[styles.button, styles.customerShareButton, !lastSavedPayload && styles.disabledButton]}
        >
          <Text style={styles.buttonText}>Customer share</Text>
        </Pressable>
      </View>

      <Section title="Preview" />
      <BillPreviewFrame payload={billPayload} />
    </ScrollView>
  );
}

function RateHero({
  goldRate,
  language,
  latestRate,
  silverRate,
}: {
  goldRate: string;
  language: Language;
  latestRate: Rate | null;
  silverRate: string;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroBrand}>
          <BrandLogo size={42} />
          <View>
            <Text style={styles.appTitle}>{SHOP.name}</Text>
            <Text style={styles.heroTitle}>{t(language, 'heroTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t(language, 'heroSubtitle')}</Text>
          </View>
        </View>
        <View style={styles.syncPill}>
          <Text style={styles.syncPillText}>{latestRate?.syncStatus === 'synced' ? 'Synced' : 'Local'}</Text>
        </View>
      </View>
      <View style={styles.rateTiles}>
        <RateTile label="Gold" metric="10 gram" value={formatMoney(goldRate)} />
        <RateTile label="Silver" metric="1 kg" tone="silver" value={formatMoney(silverRate)} />
      </View>
    </View>
  );
}

function ItemEditor({
  autoRoundFigure,
  index,
  item,
  itemNameOptions,
  language,
  onChange,
  onCreateItemName,
  onRemove,
  rates,
  rateInputValue,
  removable,
}: {
  autoRoundFigure: boolean;
  index: number;
  item: BillItemDraft;
  itemNameOptions: ItemNameOption[];
  language: Language;
  onChange: (index: number, key: keyof BillItemDraft, value: string) => void;
  onCreateItemName: (name: string, material: MetalType) => Promise<boolean>;
  onRemove: (index: number) => void;
  rates: MetalRates;
  rateInputValue: string;
  removable: boolean;
}) {
  const rate = getMetalRatePerGram(item.material, rates);
  const [showItemNames, setShowItemNames] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const suggestionQuery = itemSearch.trim() || item.itemName.trim();
  const visibleItemNames = useMemo(
    () =>
      itemNameOptions.filter(
        (option) =>
          (option.material === item.material || !item.material) &&
          includesSearch([option.name, option.material], suggestionQuery),
      ),
    [item.material, itemNameOptions, suggestionQuery],
  );
  const typedItemExists = useMemo(
    () =>
      !item.itemName.trim() ||
      itemNameOptions.some(
        (option) =>
          option.material === item.material &&
          option.name.trim().toLowerCase() === item.itemName.trim().toLowerCase(),
      ),
    [item.itemName, item.material, itemNameOptions],
  );
  const showSuggestionBar = !suggestionsDismissed && (showItemNames || !!item.itemName.trim() || !!itemSearch.trim());

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardHeader}>
        <Text style={styles.itemCardTitle}>
          {t(language, 'item')} {index + 1}
        </Text>
        {removable ? (
          <Pressable onPress={() => onRemove(index)} style={styles.removeButton}>
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.formGrid}>
        <View style={styles.segmentBlock}>
          <Text style={styles.fieldLabel}>Gold / Silver</Text>
          <MetalSelector material={item.material} onChange={(value) => onChange(index, 'material', value)} />
        </View>
        <View style={styles.fieldWide}>
          <View style={styles.itemNameRow}>
            <View style={styles.itemNameInputWrap}>
              <Field
                label={t(language, 'item')}
                value={item.itemName}
                onChangeText={(value) => {
                  onChange(index, 'itemName', value);
                  setItemSearch(value);
                  setShowItemNames(true);
                  setSuggestionsDismissed(false);
                }}
              />
            </View>
            <View style={styles.itemNameButtonRow}>
              <Pressable
                onPress={() => {
                  if (showSuggestionBar) {
                    setSuggestionsDismissed(true);
                    setShowItemNames(false);
                  } else {
                    setSuggestionsDismissed(false);
                    setShowItemNames(true);
                  }
                }}
                style={styles.itemNameToggle}
              >
                <Text style={styles.itemNameToggleText}>{showSuggestionBar ? 'Hide list' : 'Item list'}</Text>
              </Pressable>
              <Pressable
                onPress={() => void onCreateItemName(item.itemName, item.material)}
                style={[styles.itemNameToggle, styles.itemNameSaveButton]}
              >
                <Text style={styles.itemNameToggleText}>Save</Text>
              </Pressable>
            </View>
          </View>
          {showSuggestionBar ? (
            <View style={styles.itemNameSlidePanel}>
              <View style={styles.itemNameSearchRow}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  onChangeText={(value) => {
                    setItemSearch(value);
                    if (value.trim()) {
                      setShowItemNames(true);
                    }
                    setSuggestionsDismissed(false);
                  }}
                  placeholder="Search item name"
                  placeholderTextColor="#9a8f85"
                  style={styles.itemNameSearchInput}
                  value={itemSearch}
                />
              </View>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={styles.itemNameVerticalScroll}
                contentContainerStyle={styles.itemNameVerticalList}
              >
                {!typedItemExists ? (
                  <Pressable
                    onPress={async () => {
                      const ok = await onCreateItemName(item.itemName, item.material);
                      if (ok) {
                        setItemSearch(item.itemName);
                        setShowItemNames(true);
                        setSuggestionsDismissed(false);
                      }
                    }}
                    style={[styles.itemNameChip, styles.itemNameSaveChip]}
                  >
                    <Text numberOfLines={1} style={styles.itemNameChipText}>Save "{item.itemName.trim()}"</Text>
                    <Text style={styles.itemNameChipMeta}>{item.material}</Text>
                  </Pressable>
                ) : null}
                {visibleItemNames.length ? (
                  visibleItemNames.map((option) => (
                    <Pressable
                      key={`${option.id}-${option.material}`}
                      onPress={() => {
                        onChange(index, 'material', option.material);
                        onChange(index, 'itemName', option.name);
                        setItemSearch(option.name);
                        setShowItemNames(true);
                        setSuggestionsDismissed(false);
                      }}
                      style={[
                        styles.itemNameChip,
                        option.name.trim().toLowerCase() === item.itemName.trim().toLowerCase() &&
                          option.material === item.material &&
                          styles.itemNameChipActive,
                    ]}
                  >
                      <Text numberOfLines={1} style={styles.itemNameChipText}>{option.name}</Text>
                      <Text style={styles.itemNameChipMeta}>{option.material}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.itemNameSlideEmpty}>Item name nahi mila. Save chip dabao.</Text>
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>
        <Field
          keyboardType="decimal-pad"
          label={`${t(language, 'weight')} gross (gm)`}
          selectTextOnFocus
          value={item.weight}
          onChangeText={(value) => onChange(index, 'weight', value)}
        />
        <Field
          keyboardType="decimal-pad"
          label="Packet/box less (gm)"
          selectTextOnFocus
          value={item.packetLess}
          onChangeText={(value) => onChange(index, 'packetLess', value)}
        />
        <Field
          keyboardType="decimal-pad"
          label={`${t(language, 'touch')} %`}
          selectTextOnFocus
          value={item.touch}
          onChangeText={(value) => onChange(index, 'touch', value)}
        />
        <Field
          keyboardType="number-pad"
          label={t(language, 'pcs')}
          selectTextOnFocus
          value={item.pcs}
          onChangeText={(value) => onChange(index, 'pcs', value)}
        />
        <Field
          keyboardType="decimal-pad"
          label="Rate/gm"
          selectTextOnFocus
          value={rateInputValue}
          onChangeText={(value) => onChange(index, 'rate', value)}
        />
        <View style={styles.segmentBlock}>
          <Text style={styles.fieldLabel}>Labour type</Text>
          <LabourTypeSelector labourType={item.labourType ?? 'gw'} onChange={(value) => onChange(index, 'labourType', value)} />
        </View>
        <Field
          keyboardType="decimal-pad"
          label={(item.labourType ?? 'gw') === 'pcs' ? `${t(language, 'labour')} per pcs` : `${t(language, 'labour')} per gm GW`}
          selectTextOnFocus
          value={item.labour}
          onChangeText={(value) => onChange(index, 'labour', value)}
        />
      </View>
      <View style={styles.calcRow}>
        <CalcPill label="Rate/gm" value={formatMoney(parseAmount(item.rate) || rate)} />
        <CalcPill label="Net wt" value={`${formatCalcValue(Math.max(parseAmount(item.weight) - parseAmount(item.packetLess), 0), 3)} gm`} />
        <CalcPill label={t(language, 'fine')} value={`${formatCalcValue(parseAmount(item.fine), 3) || '0'} gm`} />
        <CalcPill label="Labour" value={formatBillMoney(calculateLabourCharge(item), autoRoundFigure)} />
        <CalcPill label="Labour amount" value={formatBillMoney(item.amount, autoRoundFigure)} />
      </View>
      {language !== 'en' && item.itemName.trim() ? (
        <Text style={styles.translationHint}>
          {languageNames[language]}: {translateNameOrItem(item.itemName, language)}
        </Text>
      ) : null}
    </View>
  );
}

function BillPreviewFrame({ payload, transactions = [] }: { payload: BillPayload; transactions?: BillTransaction[] }) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      style={styles.previewScroll}
      contentContainerStyle={styles.previewScrollContent}
    >
      <BillPreview payload={payload} transactions={transactions} />
    </ScrollView>
  );
}

function BillPreview({ payload, transactions = [] }: { payload: BillPayload; transactions?: BillTransaction[] }) {
  const language = payload.language;
  const visibleItems = payload.items.filter(
    (item) =>
      item.itemName.trim() ||
      item.weight.trim() ||
      item.packetLess.trim() ||
      item.touch.trim() ||
      item.fine.trim() ||
      item.pcs.trim() ||
      item.rate.trim() ||
      item.labour.trim() ||
      item.amount.trim(),
  );
  const previewRows = [...visibleItems];
  const blankRows = payload.billType === 'estimate' ? (visibleItems.length >= 9 ? 1 : visibleItems.length <= 3 ? 3 : 2) : Math.max(1, 4 - visibleItems.length);
  const targetPreviewRows = payload.billType === 'estimate' ? Math.max(visibleItems.length + blankRows, visibleItems.length ? visibleItems.length + 1 : 4) : 4;
  while (previewRows.length < targetPreviewRows) {
    previewRows.push({
      amount: '',
      fine: '',
      id: `preview-blank-${previewRows.length}`,
      itemName: '',
      labour: '',
      labourType: 'gw',
      material: 'gold',
      packetLess: '',
      pcs: '',
      rate: '',
      touch: '',
      weight: '',
    });
  }
  const title = payload.billType === 'wholesale' ? t(language, 'wholesaleBill') : t(language, 'estimate');
  const customerName = translateNameOrItem(payload.customer.name, language) || 'Customer';
  const packetLessTotal = visibleItems.reduce((total, item) => total + parseAmount(item.packetLess), 0);
  const netWeightTotal = visibleItems.reduce(
    (total, item) => total + Math.max(parseAmount(item.weight) - parseAmount(item.packetLess), 0),
    0,
  );
  const packetLessSummary =
    packetLessTotal > 0
      ? `Note: Weight column final weight hai. Packet/box less total: ${formatCalcValue(packetLessTotal, 3)} gm`
      : '';
  const labourSummary = labourSummaryLine(visibleItems, payload.autoRoundFigure);
  const bookedRateLines = rateSummaryLines(visibleItems);
  const transactionSummary = billTransactionSummary(payload, transactions);
  const previewWeightTotal = visibleItems.reduce((sum, item) => sum + Math.max(parseAmount(item.weight) - parseAmount(item.packetLess), 0), 0);
  const previewItemFineTotal = calculateTotalFine(visibleItems);
  const previewPcsTotal = visibleItems.reduce((sum, item) => sum + parseAmount(item.pcs), 0);
  const rateCutSummaryAmount = transactionSummary.rateCutAmount;
  const cashReceivedSummaryAmount = transactionSummary.cashReceivedDisplay;
  const { fineRows, moneyRows } = footerInfoSections(payload, transactions);
  const rateCutNotes = rateCutFooterNotes(payload, transactions);

  return (
    <View style={[styles.previewCard, payload.billType === 'estimate' ? styles.estimatePreview : styles.wholesalePreview]}>
      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.previewTitle}>{title}</Text>
          <Text style={styles.previewShop}>{SHOP.name}</Text>
          <Text style={styles.previewMeta}>{t(language, 'billNo')} : {payload.billNo}</Text>
        </View>
        <BrandLogo size={46} />
        <Text style={styles.previewMeta}>{t(language, 'date')} : {formatDateForBill(payload.billDate)}</Text>
      </View>

      <View style={styles.previewLineGrid}>
        <Text style={styles.previewLine}>{t(language, 'name')} : {customerName}</Text>
        <Text style={styles.previewLine}>{t(language, 'at')} : {payload.customer.address || 'Address'}</Text>
        <Text style={styles.previewLine}>{t(language, 'mobile')} : {payload.customer.mobile || 'Mobile'}</Text>
      </View>

      <View style={styles.previewBillTable}>
        <View style={[styles.previewBillRow, styles.previewBillHeaderRow]}>
          <Text style={[styles.previewBillCell, styles.previewBillItemCell]}>{t(language, 'item')}</Text>
          <Text style={[styles.previewBillCell, styles.previewBillWeightCell]}>{t(language, 'weight')}</Text>
          <Text style={[styles.previewBillCell, styles.previewBillTouchCell]}>{t(language, 'touch')}</Text>
          <Text style={[styles.previewBillCell, styles.previewBillFineCell]}>{t(language, 'fine')}</Text>
          <Text style={styles.previewBillSmallCell}>{t(language, 'pcs')}</Text>
          <Text style={[styles.previewBillCell, styles.previewBillLabourCell]}>{t(language, 'labour')}</Text>
          <Text style={[styles.previewBillCell, styles.previewBillAmountCell]}>{t(language, 'amount')}</Text>
        </View>
        {previewRows.map((item, index) => (
          <View key={`${item.id}-${index}`} style={styles.previewBillRow}>
            <Text style={[styles.previewBillCell, styles.previewBillItemCell]}>
              {item.itemName ? `${translateNameOrItem(item.itemName, language)} (${item.material})` : ''}
            </Text>
            <Text style={[styles.previewBillCell, styles.previewBillWeightCell]}>{itemWeightDisplayText(item)}</Text>
            <Text style={[styles.previewBillCell, styles.previewBillTouchCell]}>{formatPlainNumber(item.touch)}</Text>
            <Text style={[styles.previewBillCell, styles.previewBillFineCell]}>{formatPlainNumber(item.fine)}</Text>
            <Text style={styles.previewBillSmallCell}>{formatPlainNumber(item.pcs)}</Text>
            <Text style={[styles.previewBillCell, styles.previewBillLabourCell]}>{itemLabourDisplay(item)}</Text>
            <Text style={[styles.previewBillCell, styles.previewBillAmountCell]}>
              {item.amount ? formatBillMoney(item.amount, payload.autoRoundFigure) : ''}
            </Text>
          </View>
        ))}
        {payload.billType === 'estimate' ? (
          <View style={[styles.previewBillRow, styles.previewBillTotalRow]}>
            <Text style={[styles.previewBillCell, styles.previewBillItemCell]}>Total</Text>
            <Text style={[styles.previewBillCell, styles.previewBillWeightCell]}>{formatCalcValue(previewWeightTotal, 3)}</Text>
            <Text style={[styles.previewBillCell, styles.previewBillTouchCell]} />
            <Text style={[styles.previewBillCell, styles.previewBillFineCell]}>{formatCalcValue(previewItemFineTotal, 3)}</Text>
            <Text style={styles.previewBillSmallCell}>{formatPlainNumber(previewPcsTotal)}</Text>
            <Text style={[styles.previewBillCell, styles.previewBillLabourCell]}>{formatBillMoney(payload.subtotal, payload.autoRoundFigure)}</Text>
            <Text style={[styles.previewBillCell, styles.previewBillAmountCell]}>{formatBillMoney(payload.subtotal, payload.autoRoundFigure)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.previewSummaryBlock}>
        <View style={styles.previewSettlement}>
          <View style={styles.previewSettlementGroup}>
            <Text style={styles.previewSettlementHeading}>Fine summary</Text>
            {fineRows.map((row) => (
              <View key={`${row.label}-${row.value}`} style={styles.previewSettlementRow}>
                <Text style={styles.previewSettlementLabel}>{row.label}</Text>
                <Text style={styles.previewSettlementValue}>{row.value}</Text>
              </View>
            ))}
          </View>
          {moneyRows.length ? (
            <View style={styles.previewSettlementGroup}>
              <Text style={styles.previewSettlementHeading}>Receipt summary</Text>
              {moneyRows.map((row) => (
                <View key={`${row.label}-${row.value}`} style={styles.previewSettlementRow}>
                  <Text style={styles.previewSettlementLabel}>{row.label}</Text>
                  <Text style={styles.previewSettlementValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {labourSummary ? (
            <View style={styles.previewSettlementGroup}>
              <Text style={styles.previewSettlementHeading}>Labour note</Text>
              <Text style={styles.previewSettlementText}>{labourSummary}</Text>
            </View>
          ) : null}
          {bookedRateLines.length > 0 ? (
            <View style={styles.previewBookedRates}>
              {bookedRateLines.map((line) => (
                <Text key={line} style={styles.previewBookedRateText}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
          {packetLessSummary ? (
            <View style={styles.previewBookedRates}>
              <Text style={styles.previewBookedRateText}>{packetLessSummary}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.previewBottomRight}>
          <View style={styles.previewTotals}>
            <InfoLine label={t(language, 'labourTotal')} value={formatBillMoney(payload.subtotal, payload.autoRoundFigure)} />
            {rateCutSummaryAmount > 0 ? (
              <InfoLine label="Rate cut amount" value={formatBillMoney(rateCutSummaryAmount, payload.autoRoundFigure)} />
            ) : null}
            <InfoLine label="Cash rec" value={formatBillMoney(cashReceivedSummaryAmount, payload.autoRoundFigure)} />
            {transactionSummary.discountAmount > 0 ? (
              <InfoLine label="Discount" value={formatBillMoney(transactionSummary.discountAmount, payload.autoRoundFigure)} />
            ) : null}
            <InfoLine label="Amount due" value={formatBillMoney(transactionSummary.billLabourBalance, payload.autoRoundFigure)} />
          </View>
          {rateCutNotes.length ? (
            <View style={styles.previewFooterNoteBlock}>
              {rateCutNotes.map((note) => (
                <Text key={note} style={styles.previewEffectText}>
                  {note}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.previewRemainBracket}>{remainingBracketTextWithTransactions(payload, transactions)}</Text>
      <View style={styles.previewFooter}>
        <View style={styles.previewFooterLeft}>
          <Text style={styles.previewTerms}>{t(language, 'reportLine1')} {t(language, 'reportLine2')}</Text>
        </View>
        <Text style={styles.previewSignature}>{t(language, 'signature')} :</Text>
      </View>
    </View>
  );
}

function BrandLogo({ size = 56 }: { size?: number }) {
  return (
    <View style={[styles.brandLogo, { borderRadius: size / 2, height: size, width: size }]}>
      <Text style={[styles.brandLogoText, { fontSize: Math.round(size * 0.38) }]}>{SHOP.initials}</Text>
    </View>
  );
}

function RateTile({
  label,
  metric,
  tone = 'gold',
  value,
}: {
  label: string;
  metric: string;
  tone?: 'gold' | 'silver';
  value: string;
}) {
  return (
    <View style={[styles.rateTile, tone === 'silver' && styles.silverRateTile]}>
      <Text style={styles.rateLabel}>{label}</Text>
      <Text style={styles.rateValue}>{value}</Text>
      <Text style={styles.rateMetric}>{metric}</Text>
    </View>
  );
}

function BillTypeSelector({
  billType,
  language,
  onChange,
}: {
  billType: BillType;
  language: Language;
  onChange: (billType: BillType) => void;
}) {
  return (
    <Segment
      options={[
        { label: t(language, 'estimateBook'), value: 'estimate' },
        { label: t(language, 'wholesaleBill'), value: 'wholesale' },
      ]}
      value={billType}
      onChange={onChange}
    />
  );
}

function LanguageSelector({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <Segment
      options={[
        { label: 'English', value: 'en' },
        { label: 'Hindi', value: 'hi' },
        { label: 'Gujarati', value: 'gu' },
      ]}
      value={language}
      onChange={onChange}
    />
  );
}

function MetalSelector({ material, onChange }: { material: MetalType; onChange: (value: MetalType) => void }) {
  return (
    <Segment
      options={[
        { label: 'Gold', value: 'gold' },
        { label: 'Silver', value: 'silver' },
      ]}
      value={material}
      onChange={onChange}
    />
  );
}

function LabourTypeSelector({ labourType, onChange }: { labourType: LabourType; onChange: (value: LabourType) => void }) {
  return (
    <Segment
      options={[
        { label: 'GW wise', value: 'gw' },
        { label: 'PCS wise', value: 'pcs' },
      ]}
      value={labourType}
      onChange={onChange}
    />
  );
}

function ReceiptTypeSelector({ receiptType, onChange }: { receiptType: ReceiptType; onChange: (value: ReceiptType) => void }) {
  return (
    <Segment
      options={[
        { label: 'None', value: 'none' },
        { label: 'Fine', value: 'fine' },
        { label: 'Cash', value: 'cash' },
        { label: 'Fine + Cash', value: 'fine_cash' },
      ]}
      value={receiptType}
      onChange={onChange}
    />
  );
}

function TransactionModeSelector({ mode, onChange }: { mode: BillTransactionMode; onChange: (value: BillTransactionMode) => void }) {
  return (
    <Segment
      options={[
        { label: 'Cash', value: 'cash' },
        { label: 'Bank', value: 'bank' },
        { label: 'Split', value: 'split' },
        { label: 'Fine', value: 'fine' },
      ]}
      value={mode}
      onChange={onChange}
    />
  );
}

function RoundFigureSelector({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <Segment
      options={[
        { label: 'Off', value: 'off' },
        { label: 'On', value: 'on' },
      ]}
      value={enabled ? 'on' : 'off'}
      onChange={(value) => onChange(value === 'on')}
    />
  );
}

function RateCutAdjustSelector({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <Segment
      options={[
        { label: 'No', value: 'off' },
        { label: 'Yes', value: 'on' },
      ]}
      value={enabled ? 'on' : 'off'}
      onChange={(value) => onChange(value === 'on')}
    />
  );
}

function BillPeriodSelector({ period, onChange }: { period: BillPeriod; onChange: (value: BillPeriod) => void }) {
  return (
    <Segment
      options={[
        { label: "Today's", value: 'today' },
        { label: 'Weekly', value: 'week' },
        { label: 'Monthly', value: 'month' },
        { label: 'Custom', value: 'custom' },
      ]}
      value={period}
      onChange={onChange}
    />
  );
}

function Segment<T extends string>({
  onChange,
  options,
  value,
  wrap = false,
}: {
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
  wrap?: boolean;
}) {
  return (
    <View style={[styles.segment, wrap && styles.segmentWrap]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentOption, wrap && styles.segmentWrapOption, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SearchBox({
  onChangeText,
  placeholder,
  value,
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Text style={styles.fieldLabel}>Search</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9a8f85"
        style={styles.searchInput}
        value={value}
      />
    </View>
  );
}

function Field({
  editable = true,
  keyboardType,
  label,
  multiline,
  onChangeText,
  selectTextOnFocus,
  value,
}: {
  editable?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'numeric' | 'phone-pad';
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  selectTextOnFocus?: boolean;
  value: string;
}) {
  return (
    <View style={[styles.field, multiline && styles.fieldWide]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCorrect={false}
        clearButtonMode="while-editing"
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#a79a90"
        selectTextOnFocus={selectTextOnFocus}
        style={[styles.input, multiline && styles.multilineInput, !editable && styles.readonlyInput]}
        value={value}
      />
    </View>
  );
}

function DateField({ label, onChangeText, value }: { label: string; onChangeText: (value: string) => void; value: string }) {
  return (
    <Field
      keyboardType="number-pad"
      label={label}
      value={formatDateInput(value)}
      onChangeText={(nextValue) => onChangeText(formatDateInput(nextValue))}
    />
  );
}

function CalcPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.calcPill}>
      <Text style={styles.calcLabel}>{label}</Text>
      <Text style={styles.calcValue}>{value}</Text>
    </View>
  );
}

function TotalTile({ highlight, label, value }: { highlight?: boolean; label: string; value: string }) {
  return (
    <View style={[styles.totalTile, highlight && styles.totalTileHighlight]}>
      <Text style={[styles.totalTileLabel, highlight && styles.totalTileTextHighlight]}>{label}</Text>
      <Text style={[styles.totalTileValue, highlight && styles.totalTileTextHighlight]}>{value}</Text>
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function PartyLedgerPills({ ledger }: { ledger?: PartyLedgerSummary | null }) {
  if (!ledger) {
    return null;
  }

  return (
    <View style={styles.ledgerPills}>
      <View style={[styles.ledgerPill, ledger.fineAdvance > 0 ? styles.ledgerPillPositive : styles.ledgerPillDue]}>
        <Text style={styles.ledgerPillText}>
          {ledgerFineLabel(ledger)} {ledgerFineValue(ledger)}
        </Text>
      </View>
      <View style={styles.ledgerPill}>
        <Text style={styles.ledgerPillText}>Amount due {formatMoney(ledger.labourBalance)}</Text>
      </View>
      {ledger.rateCutAmount > 0 ? (
        <View style={styles.ledgerPill}>
          <Text style={styles.ledgerPillText}>Rate cut {formatMoney(ledger.rateCutAmount)}</Text>
        </View>
      ) : null}
      {ledger.discountAmount > 0 ? (
        <View style={styles.ledgerPill}>
          <Text style={styles.ledgerPillText}>Dis {formatMoney(ledger.discountAmount)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  activeFolderCard: {
    borderColor: '#9b2339',
    borderWidth: 2,
  },
  accountHero: {
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  accountHeroMeta: {
    color: '#6d665f',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  accountHeroTitle: {
    color: '#241b17',
    fontSize: 16,
    fontWeight: '900',
  },
  addItemButton: {
    marginTop: 4,
  },
  appTitle: {
    color: '#f7d777',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  brandLogo: {
    alignItems: 'center',
    backgroundColor: '#d5a642',
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderWidth: 1,
    justifyContent: 'center',
  },
  brandLogoText: {
    color: '#21170a',
    fontFamily: 'Georgia',
    fontWeight: '900',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#9b2339',
    borderRadius: 8,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  billRowMain: {
    flex: 1,
    minWidth: 145,
  },
  calcLabel: {
    color: '#6b625b',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  calcPill: {
    backgroundColor: '#f4ece3',
    borderRadius: 8,
    minWidth: 96,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  calcRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  calcValue: {
    color: '#241b17',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  clearButton: {
    backgroundColor: '#35624b',
  },
  collapsedItemMeta: {
    color: '#6d665f',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  collapsedItemRow: {
    backgroundColor: '#f8efe7',
    borderColor: '#d9b7ad',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  collapsedItemTitle: {
    color: '#5b1f2b',
    fontSize: 13,
    fontWeight: '900',
  },
  customDateGrid: {
    marginBottom: 0,
    marginTop: 8,
  },
  customerShareButton: {
    backgroundColor: '#1f7a5b',
  },
  disabledButton: {
    backgroundColor: '#8d8a86',
  },
  editIconButton: {
    alignItems: 'center',
    backgroundColor: '#9b2339',
    borderRadius: 8,
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 50,
    paddingHorizontal: 10,
  },
  editIconText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  editMenu: {
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    marginBottom: 8,
    padding: 8,
  },
  emptyPanel: {
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  emptyText: {
    color: '#6d665f',
    fontSize: 13,
  },
  field: {
    flexBasis: 118,
    flexGrow: 1,
    minWidth: 112,
  },
  fieldLabel: {
    color: '#514942',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  fieldWide: {
    minWidth: '100%',
  },
  folderAmount: {
    color: '#201917',
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  folderAmountBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
    minWidth: 88,
  },
  folderBody: {
    flex: 1,
  },
  folderCard: {
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 9,
  },
  partyHeaderCard: {
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderColor: '#9b2339',
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  folderGrid: {
    gap: 8,
  },
  folderIcon: {
    alignItems: 'center',
    backgroundColor: '#f2eadb',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  folderIconText: {
    color: '#8a6f3c',
    fontSize: 14,
    fontWeight: '900',
  },
  folderMeta: {
    color: '#6d665f',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  folderName: {
    color: '#241b17',
    fontSize: 14,
    fontWeight: '900',
  },
  ledgerPill: {
    backgroundColor: '#f2eadb',
    borderColor: '#e2d5c8',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ledgerPillDue: {
    backgroundColor: '#fff1f2',
    borderColor: '#b8243c',
  },
  ledgerPillPositive: {
    backgroundColor: '#e8f6ef',
    borderColor: '#27815d',
  },
  ledgerPillText: {
    color: '#352720',
    fontSize: 10,
    fontWeight: '900',
  },
  ledgerPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  ledgerAmounts: {
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 110,
  },
  ledgerPayment: {
    color: '#9b2339',
    fontSize: 12,
    fontWeight: '900',
  },
  ledgerReceipt: {
    color: '#1f7a5b',
    fontSize: 12,
    fontWeight: '900',
  },
  ledgerRow: {
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderColor: '#e5d9ce',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    padding: 9,
  },
  ledgerDateCell: {
    minWidth: 72,
    width: 82,
  },
  ledgerParticularCell: {
    flex: 1,
    minWidth: 120,
  },
  ledgerParticularText: {
    color: '#251a17',
    fontSize: 11,
    fontWeight: '900',
  },
  ledgerPartyText: {
    color: '#7b7069',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  ledgerTable: {
    backgroundColor: '#fffdfa',
    borderColor: '#d9cbbf',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 640,
    overflow: 'hidden',
    width: '100%',
  },
  ledgerTableScroller: {
    minWidth: '100%',
  },
  ledgerTableAmount: {
    color: '#251a17',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 82,
    textAlign: 'right',
  },
  ledgerTableCell: {
    color: '#251a17',
    fontSize: 11,
    fontWeight: '800',
  },
  ledgerTableHeader: {
    backgroundColor: '#f4eadf',
  },
  ledgerTableRow: {
    alignItems: 'center',
    borderBottomColor: '#eaded4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  panelNested: {
    backgroundColor: '#fff7ef',
    borderColor: '#ead8ca',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 8,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  hero: {
    backgroundColor: '#421a22',
    borderRadius: 8,
    padding: 10,
  },
  homeActionButton: {
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    padding: 9,
    width: '100%',
  },
  homeActionGrid: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 8,
  },
  homeActionMeta: {
    color: '#6d665f',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  homeActionTitle: {
    color: '#241b17',
    fontSize: 14,
    fontWeight: '900',
  },
  homeHero: {
    backgroundColor: '#421a22',
    borderRadius: 8,
    padding: 9,
  },
  heroBrand: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroSubtitle: {
    color: '#f1d9c4',
    fontSize: 11,
    lineHeight: 15,
    maxWidth: 300,
  },
  heroTitle: {
    color: '#fff9f0',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 21,
    marginBottom: 2,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: '#68736e',
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  infoLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  infoValue: {
    color: '#1f2421',
    flex: 1.3,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#fffdfa',
    borderColor: '#d7cec5',
    borderRadius: 8,
    borderWidth: 1,
    color: '#1f1b18',
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  itemCard: {
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 9,
  },
  itemCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  itemCardTitle: {
    color: '#331f1f',
    fontSize: 14,
    fontWeight: '900',
  },
  itemNameChip: {
    alignItems: 'center',
    backgroundColor: '#f4ece3',
    borderColor: '#d7cec5',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: 9,
    paddingVertical: 8,
    width: '100%',
  },
  itemNameChipActive: {
    backgroundColor: '#f7e9ec',
    borderColor: '#9b2339',
  },
  itemNameChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  itemNameChipMeta: {
    color: '#766960',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  itemNameChipText: {
    color: '#241b17',
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    minWidth: 0,
  },
  itemNameButtonRow: {
    flexDirection: 'row',
    gap: 7,
    width: '100%',
  },
  itemNameInputWrap: {
    width: '100%',
  },
  itemNameList: {
    gap: 7,
  },
  itemNameListMeta: {
    color: '#766960',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  itemNameListRow: {
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    padding: 10,
  },
  itemNameListTitle: {
    color: '#241b17',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  itemNamePicker: {
    backgroundColor: '#fffdfa',
    borderColor: '#eadfd5',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 8,
  },
  itemNameRow: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 7,
    width: '100%',
  },
  itemNameSaveButton: {
    backgroundColor: '#1f7a5b',
    borderColor: '#1f7a5b',
  },
  itemNameSaveChip: {
    backgroundColor: '#e7f3ed',
    borderColor: '#1f7a5b',
  },
  itemNameSearchInput: {
    backgroundColor: '#fbf6ef',
    borderColor: '#d7cec5',
    borderRadius: 8,
    borderWidth: 1,
    color: '#1f1b18',
    fontSize: 13,
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  itemNameSearchRow: {
    marginBottom: 7,
  },
  itemNameSlideEmpty: {
    alignSelf: 'center',
    color: '#6d665f',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  itemNameSlidePanel: {
    backgroundColor: '#fffdfa',
    borderColor: '#eadfd5',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 8,
  },
  itemNameVerticalList: {
    gap: 6,
    paddingBottom: 2,
  },
  itemNameVerticalScroll: {
    maxHeight: 210,
    width: '100%',
  },
  itemNameToggle: {
    alignItems: 'center',
    backgroundColor: '#8e5360',
    borderColor: '#8e5360',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  itemNameToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  multilineInput: {
    minHeight: 58,
    textAlignVertical: 'top',
  },
  page: {
    padding: 10,
    paddingBottom: 44,
  },
  panel: {
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 9,
  },
  panelTitle: {
    color: '#241b17',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  partyChip: {
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    minWidth: 118,
    padding: 8,
  },
  partyChipMeta: {
    color: '#6d665f',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  partyChipName: {
    color: '#241b17',
    fontSize: 12,
    fontWeight: '900',
  },
  partyStrip: {
    marginBottom: 8,
  },
  partySuggestionBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  partySuggestionHide: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderLeftColor: '#eadfd5',
    borderLeftWidth: 1,
    justifyContent: 'center',
    minWidth: 40,
  },
  partySuggestionHideText: {
    color: '#9b2339',
    fontSize: 14,
    fontWeight: '900',
  },
  partySuggestionList: {
    gap: 6,
    marginTop: 8,
  },
  partySuggestionMeta: {
    color: '#6d665f',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  partySuggestionName: {
    color: '#241b17',
    fontSize: 13,
    fontWeight: '900',
  },
  partySuggestionRow: {
    alignItems: 'center',
    backgroundColor: '#fbf6ef',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pendingInfo: {
    flex: 1,
    minWidth: 130,
  },
  pendingRow: {
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderColor: '#e5d9ce',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    padding: 9,
  },
  previewAmountCell: {
    textAlign: 'right',
  },
  previewBillAmountCell: {
    flex: 1.85,
    textAlign: 'right',
  },
  previewBillCell: {
    borderColor: '#b34654',
    borderLeftWidth: 1,
    color: '#5b1f2b',
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    minHeight: 31,
    paddingHorizontal: 5,
    paddingVertical: 6,
    textAlign: 'center',
  },
  previewBillHeaderRow: {
    backgroundColor: '#f7e7e4',
  },
  previewBillItemCell: {
    borderLeftWidth: 0,
    flex: 1.55,
    textAlign: 'left',
  },
  previewBillFineCell: {
    flex: 1.16,
  },
  previewBillLabourCell: {
    flex: 1.04,
  },
  previewBillRow: {
    borderBottomColor: '#b34654',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 34,
  },
  previewBillSmallCell: {
    borderColor: '#b34654',
    borderLeftWidth: 1,
    color: '#5b1f2b',
    flex: 0.48,
    fontSize: 11,
    fontWeight: '800',
    minHeight: 31,
    paddingHorizontal: 5,
    paddingVertical: 6,
    textAlign: 'center',
  },
  previewBillTouchCell: {
    flex: 0.65,
  },
  previewBillWeightCell: {
    flex: 1.32,
    fontSize: 9,
    lineHeight: 10,
  },
  previewBookedRates: {
    backgroundColor: '#fffaf8',
    borderColor: '#d8a5ad',
    borderRadius: 3,
    borderWidth: 1,
    borderTopColor: '#d8a5ad',
    gap: 4,
    marginTop: 7,
    padding: 7,
  },
  previewBookedRateText: {
    color: '#7c3642',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'left',
  },
  previewRemainBracket: {
    alignSelf: 'center',
    backgroundColor: '#fff3f5',
    borderColor: '#b34654',
    borderRadius: 4,
    borderWidth: 1,
    color: '#8f1f35',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  previewBillTable: {
    borderColor: '#b34654',
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  previewBillTotalRow: {
    backgroundColor: '#fff3f5',
  },
  previewCard: {
    backgroundColor: '#fffdfa',
    borderColor: '#d7c4bd',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 660,
    padding: 14,
    width: 660,
  },
  previewCell: {
    color: '#241b17',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  previewCustomer: {
    color: '#5d524c',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  previewFooter: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 72,
  },
  previewFooterLeft: {
    flex: 1,
    gap: 4,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  previewItemCell: {
    flex: 1.5,
  },
  previewLine: {
    borderBottomColor: '#b34654',
    borderBottomWidth: 1,
    color: '#5b1f2b',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 190,
    paddingBottom: 4,
  },
  previewLineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  previewMeta: {
    color: '#6d665f',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  previewRow: {
    borderBottomColor: '#eadfd5',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  previewShop: {
    color: '#241b17',
    fontSize: 17,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewScroll: {
    width: '100%',
  },
  previewScrollContent: {
    flexGrow: 1,
    minWidth: '100%',
    paddingBottom: 4,
  },
  previewSettlement: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 260,
    width: '100%',
  },
  previewSettlementGroup: {
    backgroundColor: '#fffaf8',
    borderColor: '#d8a5ad',
    borderRadius: 3,
    borderWidth: 1,
    flexBasis: 170,
    flexGrow: 1,
    gap: 4,
    padding: 7,
    width: '100%',
  },
  previewSettlementHeading: {
    color: '#8a2638',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewSettlementLabel: {
    color: '#7d6870',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  previewSettlementRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    width: '100%',
  },
  previewSettlementText: {
    color: '#5b1f2b',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'left',
  },
  previewSettlementValue: {
    color: '#5b1f2b',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 68,
    textAlign: 'right',
  },
  previewBottomRight: {
    alignItems: 'stretch',
    gap: 7,
    justifyContent: 'flex-end',
    maxWidth: 300,
    minWidth: 230,
  },
  previewEffectText: {
    color: '#8a2638',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 15,
    textAlign: 'left',
  },
  previewFooterNoteBlock: {
    gap: 3,
    maxWidth: 300,
  },
  previewSignature: {
    borderBottomColor: '#b34654',
    borderBottomWidth: 1,
    color: '#5b1f2b',
    fontSize: 12,
    fontWeight: '900',
    minWidth: 150,
    paddingBottom: 4,
    textAlign: 'right',
  },
  previewSummaryBlock: {
    alignItems: 'flex-start',
    backgroundColor: '#fffafa',
    borderColor: '#b34654',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 9,
    width: '100%',
  },
  previewTable: {
    marginTop: 12,
  },
  previewTerms: {
    color: '#7d3c45',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
  },
  previewTitle: {
    color: '#9b2339',
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewTotals: {
    minWidth: 0,
    maxWidth: 300,
    width: '100%',
  },
  estimatePreview: {
    borderColor: '#b34654',
    minHeight: 700,
  },
  wholesalePreview: {
    borderColor: '#aebbb3',
  },
  printButton: {
    backgroundColor: '#226a5a',
  },
  primaryActionButton: {
    backgroundColor: '#f7e9ec',
    borderColor: '#9b2339',
  },
  rateLabel: {
    color: '#61451f',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rateMetric: {
    color: '#6f5b3f',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  rateTile: {
    backgroundColor: '#f8d985',
    borderRadius: 8,
    flex: 1,
    minWidth: 112,
    minHeight: 72,
    padding: 8,
  },
  rateTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  rateValue: {
    color: '#2b1b0b',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
  },
  readonlyInput: {
    backgroundColor: '#eee8e1',
  },
  recentAmount: {
    color: '#201917',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },
  recentAmountBlock: {
    alignItems: 'flex-end',
    minWidth: 118,
  },
  recentBillNo: {
    color: '#201917',
    fontSize: 13,
    fontWeight: '900',
  },
  recentCustomer: {
    color: '#665d55',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  recentList: {
    gap: 7,
  },
  recentRow: {
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderColor: '#e5d9ce',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    padding: 9,
  },
  transactionRow: {
    alignItems: 'center',
    backgroundColor: '#fffdfa',
    borderColor: '#e5d9ce',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    padding: 9,
  },
  dueReminderRow: {
    backgroundColor: '#fff1f3',
    borderColor: '#b34654',
  },
  recentSync: {
    color: '#80766e',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
    textTransform: 'uppercase',
  },
  billActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  marketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
    width: '100%',
  },
  marketRow: {
    backgroundColor: '#fffdfa',
    borderColor: '#e5d9ce',
    borderRadius: 8,
    borderWidth: 1,
    padding: 9,
  },
  billIconButton: {
    alignItems: 'center',
    backgroundColor: '#8e5360',
    borderRadius: 7,
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 38,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  billIconButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  rowActions: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 5,
    justifyContent: 'flex-start',
    marginTop: 6,
    width: '100%',
  },
  removeButton: {
    borderColor: '#d9a5ad',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  removeButtonText: {
    color: '#9b2339',
    fontSize: 11,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#fbf6ef',
    flex: 1,
  },
  screenTitle: {
    color: '#241b17',
    flex: 1,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'right',
  },
  searchBox: {
    backgroundColor: '#fffdfa',
    borderColor: '#e4d8ce',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 9,
  },
  searchInput: {
    backgroundColor: '#fbf6ef',
    borderColor: '#d7cec5',
    borderRadius: 8,
    borderWidth: 1,
    color: '#1f1b18',
    fontSize: 14,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  navButton: {
    flexShrink: 0,
    minWidth: 78,
    width: 'auto',
  },
  secondaryButton: {
    backgroundColor: '#fffdfa',
    borderColor: '#9b2339',
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: '#9b2339',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  compactHelpBlock: {
    gap: 2,
  },
  createBookedRateList: {
    borderTopColor: '#ead1d6',
    borderTopWidth: 1,
    gap: 3,
    marginTop: 7,
    paddingTop: 7,
  },
  createBookedRateText: {
    color: '#7c3642',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 15,
  },
  createRateCutBaseBar: {
    backgroundColor: '#fff8f6',
    borderColor: '#d8a5ad',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 10,
  },
  createRateCutBaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 6,
  },
  createRateCutBaseText: {
    backgroundColor: '#fffdfa',
    borderColor: '#ead1d6',
    borderRadius: 7,
    borderWidth: 1,
    color: '#5b1f2b',
    flexGrow: 1,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 132,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  createRateCutBaseTitle: {
    color: '#8a2638',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  createTopRateItem: {
    backgroundColor: '#fffdfa',
    borderColor: '#ead1d6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 128,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  createTopRateLabel: {
    color: '#7c3642',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  createTopRateStrip: {
    backgroundColor: '#fff8f6',
    borderColor: '#d8a5ad',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 9,
    padding: 9,
  },
  createTopRateValue: {
    color: '#241b17',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
  },
  sectionHelp: {
    color: '#6d665f',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: -2,
  },
  sectionTitle: {
    color: '#241b17',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 16,
  },
  sharePanel: {
    alignItems: 'center',
    backgroundColor: '#ecf5ef',
    borderColor: '#bad7c7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 8,
    padding: 9,
  },
  sharePanelMeta: {
    color: '#4d6258',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  sharePanelTitle: {
    color: '#1f3d30',
    fontSize: 13,
    fontWeight: '900',
  },
  sharePromptActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  sharePromptButton: {
    alignItems: 'center',
    backgroundColor: '#8e5360',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 128,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sharePromptButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  sharePromptCard: {
    backgroundColor: '#fffdfa',
    borderColor: '#d8c4bb',
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 420,
    padding: 14,
    width: '100%',
  },
  sharePromptLater: {
    alignItems: 'center',
    borderColor: '#d6c9bf',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sharePromptLaterText: {
    color: '#6d6258',
    fontSize: 12,
    fontWeight: '900',
  },
  sharePromptMeta: {
    color: '#241b17',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
  },
  sharePromptOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 24, 20, 0.36)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  sharePromptText: {
    color: '#655a52',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
  },
  sharePromptTitle: {
    color: '#241b17',
    fontSize: 18,
    fontWeight: '900',
  },
  segment: {
    backgroundColor: '#eee4d9',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3,
  },
  segmentWrap: {
    flexWrap: 'wrap',
    gap: 3,
  },
  segmentActive: {
    backgroundColor: '#9b2339',
  },
  segmentBlock: {
    flexGrow: 1,
    minWidth: 148,
  },
  segmentOption: {
    borderRadius: 6,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  segmentWrapOption: {
    flexBasis: 86,
    flexGrow: 1,
  },
  segmentText: {
    color: '#6d6258',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#fff',
  },
  selectedPartyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecf5ef',
    borderColor: '#bad7c7',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  selectedPartyText: {
    color: '#1f5c45',
    fontSize: 11,
    fontWeight: '900',
  },
  silverRateTile: {
    backgroundColor: '#e5eaed',
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#8e5360',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 9,
    paddingVertical: 6,
    width: '100%',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  stripSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniButton: {
    alignItems: 'center',
    backgroundColor: '#8e5360',
    borderRadius: 7,
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    width: '100%',
  },
  miniButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  summaryLabel: {
    color: '#665d55',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryTile: {
    backgroundColor: '#f2eadb',
    borderRadius: 8,
    flex: 1,
    minWidth: 106,
    padding: 9,
  },
  summaryValue: {
    color: '#211b16',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  syncMessage: {
    color: '#6b625b',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  syncPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.24)',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  syncPillText: {
    color: '#fff4e7',
    fontSize: 11,
    fontWeight: '900',
  },
  topNav: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    minHeight: 44,
  },
  totalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  totalTile: {
    backgroundColor: '#f4ece3',
    borderRadius: 8,
    flex: 1,
    minWidth: 106,
    padding: 9,
  },
  totalTileHighlight: {
    backgroundColor: '#23362f',
  },
  totalTileLabel: {
    color: '#6b625b',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  totalTileTextHighlight: {
    color: '#fff',
  },
  totalTileValue: {
    color: '#241b17',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },
  transactionList: {
    gap: 8,
    marginTop: 10,
  },
  translationHint: {
    color: '#746960',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  viewSubTitle: {
    color: '#766960',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'right',
  },
  viewTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
});
