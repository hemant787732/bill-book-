import type { LocalDatabase } from './dbTypes';
import type {
  BillType,
  BillReminder,
  BillTransaction,
  BillTransactionMode,
  CashBankEntry,
  BillItemDraft,
  BillItemRecord,
  BillRecord,
  CustomerDraft,
  CustomerRecord,
  ItemNameOption,
  JangadReturnItem,
  JangadReturnVoucher,
  Language,
  LedgerMode,
  LabourType,
  MarketRun,
  MarketStockSummary,
  MetalType,
  OfficeEntryStatus,
  PartyFolder,
  PartyLedgerSummary,
  PartyTransaction,
  PartyTransactionMode,
  Rate,
  RecentBill,
  ReceiptType,
  ReminderStatus,
  SupplierAccount,
  SupplierLedgerSummary,
  SupplierTransaction,
  SupplierTransactionMode,
  SyncStatus,
} from '../types';
import { calculateNetWeight, calculateSubtotal, calculateTotalFine, roundFineToHalfGram } from '../utils/calculations';
import { createId, localIsoDate, nowIso, parseAmount } from '../utils/format';

const DATABASE_VERSION = 19;

type RateRow = {
  id: string;
  rate_date: string;
  gold_10g_rate: number;
  silver_1kg_rate: number;
  updated_at: string;
  sync_status: SyncStatus;
};

type CustomerRow = {
  id: string;
  name: string;
  mobile: string;
  address: string;
  opening_fine_balance?: number;
  opening_labour_balance?: number;
  opening_note?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type ItemNameRow = {
  id: string;
  name: string;
  material: MetalType;
  updated_at: string;
  sync_status: SyncStatus;
};

type BillReminderRow = {
  id: string;
  bill_id: string;
  bill_no: number;
  customer_name: string;
  customer_mobile: string;
  due_at: string;
  status: ReminderStatus;
  extended_count: number;
  notification_id: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type MarketRunRow = {
  id: string;
  run_date: string;
  gold_weight: number;
  silver_weight: number;
  note: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type BillRow = {
  id: string;
  bill_no: number;
  bill_date: string;
  bill_type: BillType;
  customer_id: string;
  customer_name: string;
  customer_mobile: string;
  customer_address: string;
  display_opening_fine_balance?: number;
  display_opening_labour_balance?: number;
  display_opening_note?: string;
  language: Language;
  subtotal: number;
  receipt_type: ReceiptType;
  receipt_material: MetalType;
  received_gross_weight: number;
  received_touch: number;
  received_fine: number;
  received_cash: number;
  received_price_override: number;
  received_value: number;
  rate_cut_fine: number;
  rate_cut_amount: number;
  rate_cut_adjusts_labour: number;
  rate_cut_booked_rate: number;
  discount_amount: number;
  net_total: number;
  payload: string;
  entry_status: OfficeEntryStatus;
  entered_at: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type BillItemRow = {
  id: string;
  bill_id: string;
  line_no: number;
  material: MetalType;
  item_name: string;
  weight: string;
  packet_less: string;
  touch: string;
  fine: string;
  pcs: string;
  rate: string;
  labour_type: LabourType;
  labour: string;
  amount: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type BillTransactionRow = {
  id: string;
  bill_id: string;
  transaction_date: string;
  mode: BillTransactionMode;
  cash_amount: number;
  bank_amount: number;
  fine_weight: number;
  rate_cut_fine: number;
  rate_cut_amount: number;
  booked_rate: number;
  note: string;
  material: MetalType;
  amount: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type PartyTransactionRow = {
  id: string;
  customer_id: string;
  voucher_no: number;
  transaction_date: string;
  mode: PartyTransactionMode;
  material: MetalType;
  cash_amount: number;
  bank_amount: number;
  fine_weight: number;
  booked_rate: number;
  fine_value: number;
  payment_amount: number;
  discount_amount: number;
  note: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type SupplierAccountRow = {
  id: string;
  entry_date: string;
  name: string;
  mobile: string;
  address: string;
  opening_fine_payable: number;
  opening_amount_payable: number;
  opening_note: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type SupplierTransactionRow = {
  id: string;
  supplier_id: string;
  voucher_no: number;
  transaction_date: string;
  mode: SupplierTransactionMode;
  material: MetalType;
  fine_weight: number;
  booked_rate: number;
  fine_value: number;
  cash_amount: number;
  bank_amount: number;
  discount_amount: number;
  note: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type CashBankEntryRow = {
  id: string;
  entry_date: string;
  mode: LedgerMode;
  particular: string;
  party: string;
  receipt_amount: number;
  payment_amount: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
};

type BillSaveInput = {
  billNo: number;
  billDate: string;
  billType: BillType;
  customer: CustomerDraft;
  items: BillItemDraft[];
  language: Language;
  receiptType: ReceiptType;
  receiptMaterial: MetalType;
  receivedGrossWeight: string;
  receivedTouch: string;
  receivedFine: string;
  receivedCash: string;
  receivedPriceOverride: string;
  receivedValue: number;
  rateCutFine: string;
  rateCutAmount: string;
  rateCutAdjustsLabour: boolean;
  rateCutBookedRate: number;
  discountAmount: string;
  netTotal: number;
};

function mapRate(row: RateRow): Rate {
  return {
    id: row.id,
    rateDate: row.rate_date,
    gold10gRate: Number(row.gold_10g_rate),
    silver1kgRate: Number(row.silver_1kg_rate),
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    address: row.address,
    openingFineBalance: Number(row.opening_fine_balance ?? 0),
    openingLabourBalance: Number(row.opening_labour_balance ?? 0),
    openingNote: row.opening_note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapItemName(row: ItemNameRow): ItemNameOption {
  return {
    id: row.id,
    material: row.material ?? 'silver',
    name: row.name,
    syncStatus: row.sync_status,
    updatedAt: row.updated_at,
  };
}

function mapBillReminder(row: BillReminderRow): BillReminder {
  return {
    id: row.id,
    billId: row.bill_id,
    billNo: Number(row.bill_no ?? 0),
    customerName: row.customer_name,
    customerMobile: row.customer_mobile,
    dueAt: row.due_at,
    status: row.status === 'done' ? 'done' : 'active',
    extendedCount: Number(row.extended_count ?? 0),
    notificationId: row.notification_id ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapMarketRun(row: MarketRunRow): MarketRun {
  return {
    id: row.id,
    runDate: row.run_date,
    goldWeight: Number(row.gold_weight ?? 0),
    silverWeight: Number(row.silver_weight ?? 0),
    note: row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapBill(row: BillRow): BillRecord {
  return {
    id: row.id,
    billNo: Number(row.bill_no),
    billDate: row.bill_date,
    billType: row.bill_type,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerMobile: row.customer_mobile,
    customerAddress: row.customer_address,
    displayOpeningFineBalance: Number(row.display_opening_fine_balance ?? 0),
    displayOpeningLabourBalance: Number(row.display_opening_labour_balance ?? 0),
    displayOpeningNote: row.display_opening_note ?? '',
    language: row.language,
    subtotal: Number(row.subtotal),
    receiptType: row.receipt_type ?? 'none',
    receiptMaterial: row.receipt_material ?? 'silver',
    receivedGrossWeight: Number(row.received_gross_weight ?? 0),
    receivedTouch: Number(row.received_touch ?? 0),
    receivedFine: Number(row.received_fine ?? 0),
    receivedCash: Number(row.received_cash ?? 0),
    receivedPriceOverride: Number(row.received_price_override ?? 0),
    receivedValue: Number(row.received_value ?? 0),
    rateCutFine: Number(row.rate_cut_fine ?? 0),
    rateCutAmount: Number(row.rate_cut_amount ?? 0),
    rateCutAdjustsLabour: Number(row.rate_cut_adjusts_labour ?? 1) === 1,
    rateCutBookedRate: Number(row.rate_cut_booked_rate ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    netTotal: Number(row.net_total ?? row.subtotal),
    payload: row.payload ?? '',
    entryStatus: row.entry_status ?? 'pending',
    enteredAt: row.entered_at ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapBillItem(row: BillItemRow): BillItemRecord {
  return {
    id: row.id,
    billId: row.bill_id,
    lineNo: Number(row.line_no),
    material: row.material ?? 'silver',
    itemName: row.item_name,
    weight: row.weight,
    packetLess: row.packet_less ?? '',
    touch: row.touch,
    fine: row.fine,
    pcs: row.pcs,
    rate: row.rate ?? '',
    labourType: row.labour_type ?? 'gw',
    labour: row.labour,
    amount: row.amount,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapBillTransaction(row: BillTransactionRow): BillTransaction {
  return {
    id: row.id,
    billId: row.bill_id,
    transactionDate: row.transaction_date,
    mode: row.mode ?? 'cash',
    cashAmount: Number(row.cash_amount ?? 0),
    bankAmount: Number(row.bank_amount ?? 0),
    fineWeight: Number(row.fine_weight ?? 0),
    rateCutFine: Number(row.rate_cut_fine ?? 0),
    rateCutAmount: Number(row.rate_cut_amount ?? 0),
    bookedRate: Number(row.booked_rate ?? 0),
    note: row.note ?? '',
    material: row.material ?? 'silver',
    amount: Number(row.amount ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapPartyTransaction(row: PartyTransactionRow): PartyTransaction {
  return {
    id: row.id,
    customerId: row.customer_id,
    voucherNo: Number(row.voucher_no ?? 0),
    transactionDate: row.transaction_date,
    mode: row.mode ?? 'cash',
    material: row.material ?? 'silver',
    cashAmount: Number(row.cash_amount ?? 0),
    bankAmount: Number(row.bank_amount ?? 0),
    fineWeight: Number(row.fine_weight ?? 0),
    bookedRate: Number(row.booked_rate ?? 0),
    fineValue: Number(row.fine_value ?? 0),
    paymentAmount: Number(row.payment_amount ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    note: row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapSupplierAccount(row: SupplierAccountRow): SupplierAccount {
  return {
    id: row.id,
    entryDate: row.entry_date || localIsoDate(),
    name: row.name,
    mobile: row.mobile,
    address: row.address,
    openingFinePayable: Number(row.opening_fine_payable ?? 0),
    openingAmountPayable: Number(row.opening_amount_payable ?? 0),
    openingNote: row.opening_note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapSupplierTransaction(row: SupplierTransactionRow): SupplierTransaction {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    voucherNo: Number(row.voucher_no ?? 0),
    transactionDate: row.transaction_date,
    mode: row.mode ?? 'purchase',
    material: row.material ?? 'silver',
    fineWeight: Number(row.fine_weight ?? 0),
    bookedRate: Number(row.booked_rate ?? 0),
    fineValue: Number(row.fine_value ?? 0),
    cashAmount: Number(row.cash_amount ?? 0),
    bankAmount: Number(row.bank_amount ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    note: row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapCashBankEntry(row: CashBankEntryRow): CashBankEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    mode: row.mode ?? 'cash',
    particular: row.particular ?? '',
    party: row.party ?? '',
    receiptAmount: Number(row.receipt_amount ?? 0),
    paymentAmount: Number(row.payment_amount ?? 0),
    date: row.entry_date,
    receipt: Number(row.receipt_amount ?? 0),
    payment: Number(row.payment_amount ?? 0),
    balance: 0,
    type: row.mode === 'bank' ? 'bank' : 'cash',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapPartyFolderRow(row: Record<string, unknown>): PartyFolder {
  return {
    customerId: textValue(row.customer_id),
    customerName: textValue(row.customer_name),
    customerMobile: textValue(row.customer_mobile),
    customerAddress: textValue(row.customer_address),
    billCount: Number(row.bill_count ?? 0),
    lastBillDate: textValue(row.last_bill_date),
    totalAmount: Number(row.total_amount ?? 0),
  };
}

function mapRecentBillRow(row: Record<string, unknown>): RecentBill {
  return {
    id: textValue(row.id),
    billNo: Number(row.bill_no ?? 0),
    billDate: textValue(row.bill_date),
    billType: textValue(row.bill_type) as BillType,
    customerId: textValue(row.customer_id),
    customerName: textValue(row.customer_name),
    customerMobile: textValue(row.customer_mobile),
    customerAddress: textValue(row.customer_address),
    netTotal: Number(row.net_total ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    entryStatus: textValue(row.entry_status) as OfficeEntryStatus,
    syncStatus: textValue(row.sync_status) as SyncStatus,
  };
}

function mapJangadReturnVoucher(row: Record<string, unknown>): JangadReturnVoucher {
  return {
    id: textValue(row.id),
    billId: textValue(row.bill_id),
    customerId: textValue(row.customer_id),
    returnDate: textValue(row.return_date),
    note: textValue(row.note),
    createdAt: textValue(row.created_at),
  };
}

function mapJangadReturnItem(row: Record<string, unknown>): JangadReturnItem {
  return {
    id: textValue(row.id),
    voucherId: textValue(row.voucher_id),
    itemName: textValue(row.item_name),
    weight: Number(row.weight ?? 0),
    pcs: Number(row.pcs ?? 0),
  };
}

function textValue(value: string | number | null | undefined) {
  return String(value ?? '').trim();
}

function numberValue(value: string | number | null | undefined) {
  return Number(parseAmount(value).toFixed(6));
}

function inputItemBusinessSignature(item: BillItemDraft, index: number) {
  return {
    lineNo: index + 1,
    material: item.material,
    itemName: textValue(item.itemName),
    weight: numberValue(item.weight),
    packetLess: numberValue(item.packetLess),
    touch: numberValue(item.touch),
    fine: numberValue(item.fine),
    pcs: numberValue(item.pcs),
    rate: numberValue(item.rate),
    labourType: textValue(item.labourType ?? 'gw'),
    labour: numberValue(item.labour),
    amount: numberValue(item.amount),
  };
}

function rowItemBusinessSignature(item: BillItemRow) {
  return {
    lineNo: Number(item.line_no),
    material: item.material ?? 'silver',
    itemName: textValue(item.item_name),
    weight: numberValue(item.weight),
    packetLess: numberValue(item.packet_less),
    touch: numberValue(item.touch),
    fine: numberValue(item.fine),
    pcs: numberValue(item.pcs),
    rate: numberValue(item.rate),
    labourType: textValue(item.labour_type ?? 'gw'),
    labour: numberValue(item.labour),
    amount: numberValue(item.amount),
  };
}

function inputBusinessSignature(input: BillSaveInput, cleanItems: BillItemDraft[], subtotal: number) {
  return {
    billNo: input.billNo,
    billDate: input.billDate,
    billType: input.billType,
    customerName: textValue(input.customer.name),
    customerMobile: textValue(input.customer.mobile),
    customerAddress: textValue(input.customer.address),
    displayOpeningFineBalance: numberValue(input.customer.openingFineBalance),
    displayOpeningLabourBalance: numberValue(input.customer.openingLabourBalance),
    subtotal: numberValue(subtotal),
    receiptType: input.receiptType,
    receiptMaterial: input.receiptMaterial,
    receivedGrossWeight: numberValue(input.receivedGrossWeight),
    receivedTouch: numberValue(input.receivedTouch),
    receivedFine: numberValue(input.receivedFine),
    receivedCash: numberValue(input.receivedCash),
    receivedPriceOverride: numberValue(input.receivedPriceOverride),
    receivedValue: numberValue(input.receivedValue),
    rateCutFine: numberValue(input.rateCutFine),
    rateCutAmount: numberValue(input.rateCutAmount),
    rateCutAdjustsLabour: input.rateCutAdjustsLabour,
    rateCutBookedRate: numberValue(input.rateCutBookedRate),
    discountAmount: numberValue(input.discountAmount),
    netTotal: numberValue(input.netTotal),
    items: cleanItems.map(inputItemBusinessSignature),
  };
}

function rowBusinessSignature(row: BillRow, items: BillItemRow[]) {
  return {
    billNo: Number(row.bill_no),
    billDate: row.bill_date,
    billType: row.bill_type,
    customerName: textValue(row.customer_name),
    customerMobile: textValue(row.customer_mobile),
    customerAddress: textValue(row.customer_address),
    displayOpeningFineBalance: numberValue(row.display_opening_fine_balance),
    displayOpeningLabourBalance: numberValue(row.display_opening_labour_balance),
    subtotal: numberValue(row.subtotal),
    receiptType: row.receipt_type ?? 'none',
    receiptMaterial: row.receipt_material ?? 'silver',
    receivedGrossWeight: numberValue(row.received_gross_weight),
    receivedTouch: numberValue(row.received_touch),
    receivedFine: numberValue(row.received_fine),
    receivedCash: numberValue(row.received_cash),
    receivedPriceOverride: numberValue(row.received_price_override),
    receivedValue: numberValue(row.received_value),
    rateCutFine: numberValue(row.rate_cut_fine),
    rateCutAmount: numberValue(row.rate_cut_amount),
    rateCutAdjustsLabour: Number(row.rate_cut_adjusts_labour ?? 1) === 1,
    rateCutBookedRate: numberValue(row.rate_cut_booked_rate),
    discountAmount: numberValue(row.discount_amount),
    netTotal: numberValue(row.net_total),
    items: [...items].sort((a, b) => Number(a.line_no) - Number(b.line_no)).map(rowItemBusinessSignature),
  };
}

function hasBusinessChanges(row: BillRow, items: BillItemRow[], input: BillSaveInput, cleanItems: BillItemDraft[], subtotal: number) {
  return JSON.stringify(rowBusinessSignature(row, items)) !== JSON.stringify(inputBusinessSignature(input, cleanItems, subtotal));
}

function groupItemsByBillId(items: BillItemRow[]) {
  const grouped = new Map<string, BillItemRow[]>();
  for (const item of items) {
    const rows = grouped.get(item.bill_id) ?? [];
    rows.push(item);
    grouped.set(item.bill_id, rows);
  }
  return grouped;
}

function groupTransactionsByBillId(transactions: BillTransactionRow[]) {
  const grouped = new Map<string, BillTransactionRow[]>();
  for (const transaction of transactions) {
    const rows = grouped.get(transaction.bill_id) ?? [];
    rows.push(transaction);
    grouped.set(transaction.bill_id, rows);
  }
  return grouped;
}

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

function bookedRateUnitCandidatesFromRows(items: BillItemRow[]) {
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

function sanitizeMirroredDiscountAmount(row: BillRow, items: BillItemRow[] = []) {
  const discountAmount = Number(row.discount_amount ?? 0);
  const rateCutAmount = Number(row.rate_cut_amount ?? 0);
  const rateCutBookedRate = Number(row.rate_cut_booked_rate ?? 0);
  const rateCutFine = Number(row.rate_cut_fine ?? 0);
  const bookedRateCandidates = [rateCutBookedRate, ...bookedRateUnitCandidatesFromRows(items)].filter((value) => value > 0);
  const mirrorsRateCutAmount = discountAmount > 0 && rateCutAmount > 0 && Math.abs(discountAmount - rateCutAmount) < 0.01;
  const mirrorsBookedRate = discountAmount > 0 && bookedRateCandidates.some((rate) => Math.abs(discountAmount - rate) < 0.01);

  if (rateCutFine > 0 && (mirrorsRateCutAmount || mirrorsBookedRate)) {
    return 0;
  }

  return discountAmount;
}

function exactBillNetTotal(row: BillRow, items: BillItemRow[]) {
  const storedSubtotal = Number(row.subtotal ?? 0);
  const discountAmount = sanitizeMirroredDiscountAmount(row, items);
  const rateCutReceived = Number(row.rate_cut_amount ?? 0);
  const receivedValue =
    row.receipt_type === 'cash' || row.receipt_type === 'fine_cash'
      ? Number(row.received_value ?? row.received_cash ?? 0)
      : 0;
  const itemSubtotal = calculateSubtotal(items.map(mapBillItem));
  const subtotal = itemSubtotal > 0 ? itemSubtotal : Math.max(storedSubtotal, 0);
  const exactNet = Math.max(subtotal + rateCutReceived - receivedValue - discountAmount, 0);

  return {
    discountAmount,
    exactNet,
    rateCutReceived,
    receivedValue,
    storedSubtotal,
    subtotal,
  };
}

function resolveBillMoney(row: BillRow, items: BillItemRow[]) {
  const { exactNet, rateCutReceived, receivedValue, storedSubtotal, subtotal } = exactBillNetTotal(row, items);
  const storedNet = Number(row.net_total ?? exactNet);
  const canTrustStoredNet = Math.abs(storedSubtotal - subtotal) < 0.01 || Math.abs(storedSubtotal - (subtotal + rateCutReceived)) < 0.01;
  const roundedNet = roundToTen(exactNet);
  const hasRoundedNet = canTrustStoredNet && Math.abs(storedNet - roundedNet) < 0.01 && Math.abs(storedNet - exactNet) > 0.01;
  const hasManualNet = canTrustStoredNet && storedNet > 0 && !hasRoundedNet && Math.abs(storedNet - exactNet) > 0.01;
  const netTotal = hasRoundedNet || hasManualNet ? storedNet : exactNet;

  return {
    autoRoundFigure: hasRoundedNet,
    finalAmountOverride: hasManualNet ? String(storedNet) : '',
    netTotal,
    receivedValue,
    subtotal,
  };
}

function resolveBillListMoney(row: BillRow, items: BillItemRow[], transactions: BillTransactionRow[] = []) {
  const money = resolveBillMoney(row, items);
  const postCashBankReceived = transactions.reduce(
    (sum, transaction) => sum + Number(transaction.cash_amount ?? 0) + Number(transaction.bank_amount ?? 0),
    0,
  );
  const postRateCutAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.rate_cut_amount ?? 0), 0);

  return {
    ...money,
    netTotal: Math.max(money.netTotal - postCashBankReceived + postRateCutAmount, 0),
  };
}

export async function migrateDbIfNeeded(db: LocalDatabase) {
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = current?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS rates (
        id TEXT PRIMARY KEY NOT NULL,
        rate_date TEXT NOT NULL UNIQUE,
        gold_10g_rate REAL NOT NULL,
        silver_1kg_rate REAL NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        address TEXT NOT NULL,
        opening_fine_balance REAL NOT NULL DEFAULT 0,
        opening_labour_balance REAL NOT NULL DEFAULT 0,
        opening_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS customers_mobile_idx ON customers(mobile);

      CREATE TABLE IF NOT EXISTS item_names (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        material TEXT NOT NULL DEFAULT 'silver',
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        UNIQUE(name, material)
      );

      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY NOT NULL,
        bill_no INTEGER NOT NULL UNIQUE,
        bill_date TEXT NOT NULL,
        bill_type TEXT NOT NULL DEFAULT 'estimate',
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_mobile TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        display_opening_fine_balance REAL NOT NULL DEFAULT 0,
        display_opening_labour_balance REAL NOT NULL DEFAULT 0,
        display_opening_note TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        receipt_type TEXT NOT NULL DEFAULT 'none',
        receipt_material TEXT NOT NULL DEFAULT 'silver',
        received_gross_weight REAL NOT NULL DEFAULT 0,
        received_touch REAL NOT NULL DEFAULT 0,
        received_fine REAL NOT NULL DEFAULT 0,
        received_cash REAL NOT NULL DEFAULT 0,
        received_price_override REAL NOT NULL DEFAULT 0,
        received_value REAL NOT NULL DEFAULT 0,
        rate_cut_fine REAL NOT NULL DEFAULT 0,
        rate_cut_amount REAL NOT NULL DEFAULT 0,
        rate_cut_adjusts_labour INTEGER NOT NULL DEFAULT 1,
        rate_cut_booked_rate REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        net_total REAL NOT NULL DEFAULT 0,
        entry_status TEXT NOT NULL DEFAULT 'pending',
        entered_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS bills_bill_date_idx ON bills(bill_date);

      CREATE TABLE IF NOT EXISTS bill_reminders (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL UNIQUE,
        bill_no INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        customer_mobile TEXT NOT NULL,
        due_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        extended_count INTEGER NOT NULL DEFAULT 0,
        notification_id TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS bill_reminders_due_at_idx ON bill_reminders(due_at);

      CREATE TABLE IF NOT EXISTS market_runs (
        id TEXT PRIMARY KEY NOT NULL,
        run_date TEXT NOT NULL UNIQUE,
        gold_weight REAL NOT NULL DEFAULT 0,
        silver_weight REAL NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS market_runs_run_date_idx ON market_runs(run_date);

      CREATE TABLE IF NOT EXISTS bill_items (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL,
        line_no INTEGER NOT NULL,
        material TEXT NOT NULL DEFAULT 'silver',
        item_name TEXT NOT NULL,
        weight TEXT NOT NULL,
        packet_less TEXT NOT NULL DEFAULT '',
        touch TEXT NOT NULL,
        fine TEXT NOT NULL,
        pcs TEXT NOT NULL,
        rate TEXT NOT NULL DEFAULT '',
        labour_type TEXT NOT NULL DEFAULT 'gw',
        labour TEXT NOT NULL,
        amount TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS bill_items_bill_id_idx ON bill_items(bill_id);

      CREATE TABLE IF NOT EXISTS bill_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL,
        transaction_date TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'cash',
        cash_amount REAL NOT NULL DEFAULT 0,
        bank_amount REAL NOT NULL DEFAULT 0,
        fine_weight REAL NOT NULL DEFAULT 0,
        rate_cut_fine REAL NOT NULL DEFAULT 0,
        rate_cut_amount REAL NOT NULL DEFAULT 0,
        booked_rate REAL NOT NULL DEFAULT 0,
        material TEXT NOT NULL DEFAULT 'silver',
        amount REAL NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS bill_transactions_bill_id_idx ON bill_transactions(bill_id);

      CREATE TABLE IF NOT EXISTS party_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        customer_id TEXT NOT NULL,
        voucher_no INTEGER NOT NULL UNIQUE,
        transaction_date TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'cash',
        material TEXT NOT NULL DEFAULT 'silver',
        cash_amount REAL NOT NULL DEFAULT 0,
        bank_amount REAL NOT NULL DEFAULT 0,
        fine_weight REAL NOT NULL DEFAULT 0,
        booked_rate REAL NOT NULL DEFAULT 0,
        fine_value REAL NOT NULL DEFAULT 0,
        payment_amount REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS party_transactions_customer_id_idx ON party_transactions(customer_id);

      CREATE TABLE IF NOT EXISTS jangad_return_vouchers (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        return_date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS jangad_return_items (
        id TEXT PRIMARY KEY NOT NULL,
        voucher_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 0,
        pcs INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (voucher_id) REFERENCES jangad_return_vouchers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS jangad_returns_bill_id_idx ON jangad_return_vouchers(bill_id);
      CREATE INDEX IF NOT EXISTS jangad_returns_customer_id_idx ON jangad_return_vouchers(customer_id);
      CREATE INDEX IF NOT EXISTS jangad_return_items_voucher_id_idx ON jangad_return_items(voucher_id);

      CREATE TABLE IF NOT EXISTS supplier_accounts (
        id TEXT PRIMARY KEY NOT NULL,
        entry_date TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        mobile TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        opening_fine_payable REAL NOT NULL DEFAULT 0,
        opening_amount_payable REAL NOT NULL DEFAULT 0,
        opening_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS supplier_accounts_mobile_idx ON supplier_accounts(mobile);

      CREATE TABLE IF NOT EXISTS supplier_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        supplier_id TEXT NOT NULL,
        voucher_no INTEGER NOT NULL UNIQUE,
        transaction_date TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'purchase',
        material TEXT NOT NULL DEFAULT 'silver',
        fine_weight REAL NOT NULL DEFAULT 0,
        booked_rate REAL NOT NULL DEFAULT 0,
        fine_value REAL NOT NULL DEFAULT 0,
        cash_amount REAL NOT NULL DEFAULT 0,
        bank_amount REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (supplier_id) REFERENCES supplier_accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS supplier_transactions_supplier_id_idx ON supplier_transactions(supplier_id);

      CREATE TABLE IF NOT EXISTS cash_bank_entries (
        id TEXT PRIMARY KEY NOT NULL,
        entry_date TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'cash',
        particular TEXT NOT NULL DEFAULT '',
        party TEXT NOT NULL DEFAULT '',
        receipt_amount REAL NOT NULL DEFAULT 0,
        payment_amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS cash_bank_entries_date_idx ON cash_bank_entries(entry_date);
    `);

    const today = localIsoDate();
    await db.runAsync(
      `INSERT OR IGNORE INTO rates
        (id, rate_date, gold_10g_rate, silver_1kg_rate, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [createId('rate'), today, 62310, 1898, nowIso()],
    );
  }

  if (currentVersion === 1) {
    await db.execAsync(`
      ALTER TABLE bills ADD COLUMN bill_type TEXT NOT NULL DEFAULT 'estimate';
    `);
  }

  if (currentVersion > 0 && currentVersion < 3) {
    await db.execAsync(`
      ALTER TABLE bills ADD COLUMN receipt_type TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE bills ADD COLUMN receipt_material TEXT NOT NULL DEFAULT 'silver';
      ALTER TABLE bills ADD COLUMN received_fine REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN received_cash REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN received_value REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN net_total REAL NOT NULL DEFAULT 0;
      ALTER TABLE bill_items ADD COLUMN material TEXT NOT NULL DEFAULT 'silver';
      UPDATE bills SET net_total = subtotal WHERE net_total = 0;
    `);
  }

  if (currentVersion > 0 && currentVersion < 4) {
    await db.execAsync(`
      ALTER TABLE bills ADD COLUMN received_gross_weight REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN received_touch REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN received_price_override REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN entry_status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE bills ADD COLUMN entered_at TEXT NOT NULL DEFAULT '';
    `);
  }

  if (currentVersion > 0 && currentVersion < 5) {
    await db.execAsync(`
      ALTER TABLE bill_items ADD COLUMN packet_less TEXT NOT NULL DEFAULT '';
      ALTER TABLE bill_items ADD COLUMN rate TEXT NOT NULL DEFAULT '';
    `);
  }

  if (currentVersion > 0 && currentVersion < 6) {
    await db.execAsync(`
      ALTER TABLE bill_items ADD COLUMN labour_type TEXT NOT NULL DEFAULT 'gw';
    `);
  }

  if (currentVersion > 0 && currentVersion < 7) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS item_names (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        material TEXT NOT NULL DEFAULT 'silver',
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        UNIQUE(name, material)
      );
    `);
  }

  if (currentVersion > 0 && currentVersion < 8) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_reminders (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL UNIQUE,
        bill_no INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        customer_mobile TEXT NOT NULL,
        due_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        extended_count INTEGER NOT NULL DEFAULT 0,
        notification_id TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS bill_reminders_due_at_idx ON bill_reminders(due_at);

      CREATE TABLE IF NOT EXISTS market_runs (
        id TEXT PRIMARY KEY NOT NULL,
        run_date TEXT NOT NULL UNIQUE,
        gold_weight REAL NOT NULL DEFAULT 0,
        silver_weight REAL NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS market_runs_run_date_idx ON market_runs(run_date);
    `);
  }

  if (currentVersion > 0 && currentVersion < 9) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL,
        transaction_date TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'cash',
        cash_amount REAL NOT NULL DEFAULT 0,
        bank_amount REAL NOT NULL DEFAULT 0,
        fine_weight REAL NOT NULL DEFAULT 0,
        rate_cut_fine REAL NOT NULL DEFAULT 0,
        rate_cut_amount REAL NOT NULL DEFAULT 0,
        booked_rate REAL NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS bill_transactions_bill_id_idx ON bill_transactions(bill_id);
    `);
  }

  if (currentVersion > 0 && currentVersion < 10) {
    await db.execAsync(`
      ALTER TABLE bills ADD COLUMN rate_cut_fine REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN rate_cut_amount REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN rate_cut_booked_rate REAL NOT NULL DEFAULT 0;
    `);
  }

  if (currentVersion > 0 && currentVersion < 11) {
    await db.execAsync(`
      ALTER TABLE bills ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;
    `);
  }

  if (currentVersion > 0 && currentVersion < 12) {
    await db.execAsync(`
      ALTER TABLE bills ADD COLUMN rate_cut_adjusts_labour INTEGER NOT NULL DEFAULT 1;
    `);
  }

  if (currentVersion > 0 && currentVersion < 13) {
    await db.execAsync(`
      ALTER TABLE customers ADD COLUMN opening_fine_balance REAL NOT NULL DEFAULT 0;
      ALTER TABLE customers ADD COLUMN opening_labour_balance REAL NOT NULL DEFAULT 0;
      ALTER TABLE customers ADD COLUMN opening_note TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS party_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        customer_id TEXT NOT NULL,
        voucher_no INTEGER NOT NULL UNIQUE,
        transaction_date TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'cash',
        material TEXT NOT NULL DEFAULT 'silver',
        cash_amount REAL NOT NULL DEFAULT 0,
        bank_amount REAL NOT NULL DEFAULT 0,
        fine_weight REAL NOT NULL DEFAULT 0,
        booked_rate REAL NOT NULL DEFAULT 0,
        fine_value REAL NOT NULL DEFAULT 0,
        payment_amount REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS party_transactions_customer_id_idx ON party_transactions(customer_id);
    `);
  }

  if (currentVersion > 0 && currentVersion < 14) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS supplier_accounts (
        id TEXT PRIMARY KEY NOT NULL,
        entry_date TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        mobile TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        opening_fine_payable REAL NOT NULL DEFAULT 0,
        opening_amount_payable REAL NOT NULL DEFAULT 0,
        opening_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS supplier_accounts_mobile_idx ON supplier_accounts(mobile);

      CREATE TABLE IF NOT EXISTS supplier_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        supplier_id TEXT NOT NULL,
        voucher_no INTEGER NOT NULL UNIQUE,
        transaction_date TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'purchase',
        material TEXT NOT NULL DEFAULT 'silver',
        fine_weight REAL NOT NULL DEFAULT 0,
        booked_rate REAL NOT NULL DEFAULT 0,
        fine_value REAL NOT NULL DEFAULT 0,
        cash_amount REAL NOT NULL DEFAULT 0,
        bank_amount REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (supplier_id) REFERENCES supplier_accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS supplier_transactions_supplier_id_idx ON supplier_transactions(supplier_id);
    `);
  }

  if (currentVersion > 0 && currentVersion < 15) {
    await db.execAsync(`
      ALTER TABLE bills ADD COLUMN display_opening_fine_balance REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN display_opening_labour_balance REAL NOT NULL DEFAULT 0;
      ALTER TABLE bills ADD COLUMN display_opening_note TEXT NOT NULL DEFAULT '';
      UPDATE bills
      SET
        display_opening_fine_balance = COALESCE((SELECT opening_fine_balance FROM customers WHERE customers.id = bills.customer_id), 0),
        display_opening_labour_balance = COALESCE((SELECT opening_labour_balance FROM customers WHERE customers.id = bills.customer_id), 0),
        display_opening_note = COALESCE((SELECT opening_note FROM customers WHERE customers.id = bills.customer_id), '')
      WHERE COALESCE(display_opening_fine_balance, 0) = 0
        AND COALESCE(display_opening_labour_balance, 0) = 0
        AND COALESCE(display_opening_note, '') = '';
    `);
  }

  if (currentVersion > 0 && currentVersion < 16) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cash_bank_entries (
        id TEXT PRIMARY KEY NOT NULL,
        entry_date TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'cash',
        particular TEXT NOT NULL DEFAULT '',
        party TEXT NOT NULL DEFAULT '',
        receipt_amount REAL NOT NULL DEFAULT 0,
        payment_amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS cash_bank_entries_date_idx ON cash_bank_entries(entry_date);
    `);
  }

  if (currentVersion >= 14 && currentVersion < 17) {
    await db.execAsync(`
      ALTER TABLE supplier_accounts ADD COLUMN entry_date TEXT NOT NULL DEFAULT '';
      UPDATE supplier_accounts SET entry_date = substr(created_at, 1, 10) WHERE COALESCE(entry_date, '') = '';
    `);
  }

  if (currentVersion >= 1 && currentVersion < 18) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS jangad_return_vouchers (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        return_date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS jangad_return_items (
        id TEXT PRIMARY KEY NOT NULL,
        voucher_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 0,
        pcs INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (voucher_id) REFERENCES jangad_return_vouchers(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS jangad_returns_bill_id_idx ON jangad_return_vouchers(bill_id);
      CREATE INDEX IF NOT EXISTS jangad_returns_customer_id_idx ON jangad_return_vouchers(customer_id);
      CREATE INDEX IF NOT EXISTS jangad_return_items_voucher_id_idx ON jangad_return_items(voucher_id);
    `);
  }

  if (currentVersion >= 1 && currentVersion < 19) {
    await db.execAsync(`
      ALTER TABLE bill_transactions ADD COLUMN material TEXT NOT NULL DEFAULT 'silver';
      ALTER TABLE bill_transactions ADD COLUMN amount REAL NOT NULL DEFAULT 0;
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export async function getLatestRate(db: LocalDatabase) {
  const row = await db.getFirstAsync<RateRow>('SELECT * FROM rates ORDER BY rate_date DESC LIMIT 1');
  return row ? mapRate(row) : null;
}

export async function upsertRate(
  db: LocalDatabase,
  input: { rateDate: string; silver1kgRate: number; gold10gRate?: number },
) {
  const timestamp = nowIso();
  const existing = await db.getFirstAsync<RateRow>('SELECT * FROM rates WHERE rate_date = ?', [
    input.rateDate,
  ]);
  const id = existing?.id ?? createId('rate');

  await db.runAsync(
    `INSERT INTO rates (id, rate_date, gold_10g_rate, silver_1kg_rate, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, 'pending')
     ON CONFLICT(rate_date) DO UPDATE SET
       gold_10g_rate = excluded.gold_10g_rate,
       silver_1kg_rate = excluded.silver_1kg_rate,
       updated_at = excluded.updated_at,
       sync_status = 'pending'`,
    [id, input.rateDate, input.gold10gRate ?? 0, input.silver1kgRate, timestamp],
  );

  const row = await db.getFirstAsync<RateRow>('SELECT * FROM rates WHERE rate_date = ?', [input.rateDate]);
  return row ? mapRate(row) : null;
}

export async function getNextBillNo(db: LocalDatabase, billType?: BillType) {
  if (billType === 'jangad') {
    const row = await db.getFirstAsync<{ next_bill_no: number }>(
      'SELECT COALESCE(MAX(bill_no), 1) + 1 AS next_bill_no FROM bills WHERE bill_type = ?',
      'jangad',
    );
    return row?.next_bill_no ?? 1;
  }
  const row = await db.getFirstAsync<{ next_bill_no: number }>(
    'SELECT COALESCE(MAX(bill_no), 100) + 1 AS next_bill_no FROM bills WHERE bill_type = ? OR bill_type IS NULL',
    'estimate',
  );
  return row?.next_bill_no ?? 101;
}

export async function getNextVoucherNo(db: LocalDatabase) {
  const row = await db.getFirstAsync<{ next_voucher_no: number }>(
    'SELECT COALESCE(MAX(voucher_no), 0) + 1 AS next_voucher_no FROM party_transactions',
  );
  return row?.next_voucher_no ?? 1;
}

export async function getNextSupplierVoucherNo(db: LocalDatabase) {
  const row = await db.getFirstAsync<{ next_voucher_no: number }>(
    'SELECT COALESCE(MAX(voucher_no), 0) + 1 AS next_voucher_no FROM supplier_transactions',
  );
  return row?.next_voucher_no ?? 1;
}

async function upsertCustomer(db: LocalDatabase, draft: CustomerDraft) {
  const timestamp = nowIso();
  const selectedId = draft.id?.trim();
  const trimmedMobile = draft.mobile.trim();
  const existing = selectedId
    ? await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id = ?', [selectedId])
    : trimmedMobile
    ? await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE mobile = ? ORDER BY updated_at DESC', [
        trimmedMobile,
      ])
    : null;

  const id = existing?.id ?? selectedId ?? createId('cus');
  const createdAt = existing?.created_at ?? timestamp;
  const openingFine = draft.openingFineBalance === undefined ? Number(existing?.opening_fine_balance ?? 0) : parseAmount(draft.openingFineBalance);
  const openingLabour =
    draft.openingLabourBalance === undefined ? Number(existing?.opening_labour_balance ?? 0) : parseAmount(draft.openingLabourBalance);
  const openingNote = draft.openingNote === undefined ? existing?.opening_note ?? '' : draft.openingNote.trim();

  await db.runAsync(
    `INSERT INTO customers (id, name, mobile, address, opening_fine_balance, opening_labour_balance, opening_note, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       mobile = excluded.mobile,
       address = excluded.address,
       opening_fine_balance = excluded.opening_fine_balance,
       opening_labour_balance = excluded.opening_labour_balance,
       opening_note = excluded.opening_note,
       updated_at = excluded.updated_at,
       sync_status = 'pending'`,
    [
      id,
      draft.name.trim(),
      trimmedMobile,
      draft.address.trim(),
      openingFine,
      openingLabour,
      openingNote,
      createdAt,
      timestamp,
    ],
  );

  const row = await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id = ?', [id]);
  if (!row) {
    throw new Error('Customer could not be saved.');
  }

  return mapCustomer(row);
}

export async function saveCustomer(db: LocalDatabase, draft: CustomerDraft) {
  if (!draft.name.trim()) {
    throw new Error('Party name required.');
  }

  return upsertCustomer(db, draft);
}

export async function createItemName(db: LocalDatabase, name: string, material: MetalType) {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Item name required.');
  }

  const timestamp = nowIso();
  const id = createId('iname');
  await db.runAsync(
    `INSERT INTO item_names (id, name, material, updated_at, sync_status)
     VALUES (?, ?, ?, ?, 'pending')
     ON CONFLICT(name, material) DO UPDATE SET
       updated_at = excluded.updated_at,
       sync_status = 'pending'`,
    [id, cleanName, material, timestamp],
  );

  const row = await db.getFirstAsync<ItemNameRow>('SELECT * FROM item_names WHERE name = ? AND material = ?', [
    cleanName,
    material,
  ]);
  if (!row) {
    throw new Error('Item name save nahi hua.');
  }

  return mapItemName(row);
}

export async function getItemNames(db: LocalDatabase): Promise<ItemNameOption[]> {
  const [savedRows, itemRows] = await Promise.all([
    db.getAllAsync<ItemNameRow>('SELECT * FROM item_names ORDER BY name ASC'),
    db.getAllAsync<BillItemRow>('SELECT * FROM bill_items ORDER BY bill_id ASC, line_no ASC'),
  ]);
  const itemMap = new Map<string, ItemNameOption>();

  for (const row of savedRows) {
    if (!row.name.trim()) {
      continue;
    }
    const option = mapItemName(row);
    itemMap.set(`${option.material}:${option.name.toLowerCase()}`, option);
  }

  for (const item of itemRows) {
    const cleanName = item.item_name.trim();
    if (!cleanName) {
      continue;
    }
    const material = item.material ?? 'silver';
    const key = `${material}:${cleanName.toLowerCase()}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        id: `history-${material}-${cleanName.toLowerCase()}`,
        material,
        name: cleanName,
        syncStatus: 'synced',
        updatedAt: item.updated_at,
      });
    }
  }

  return [...itemMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function billCustomerProfileDraft(customer: CustomerDraft): CustomerDraft {
  return {
    address: customer.address,
    id: customer.id,
    mobile: customer.mobile,
    name: customer.name,
  };
}

export async function createBill(db: LocalDatabase, input: BillSaveInput) {
  const timestamp = nowIso();
  const customer = await upsertCustomer(db, billCustomerProfileDraft(input.customer));
  const billId = createId('bill');
  const cleanItems = input.items.filter((item) => item.itemName.trim());
  const subtotal = calculateSubtotal(cleanItems);

  await db.runAsync(
    `INSERT INTO bills
      (id, bill_no, bill_date, bill_type, customer_id, customer_name, customer_mobile, customer_address,
        display_opening_fine_balance, display_opening_labour_balance, display_opening_note,
        language, subtotal, receipt_type, receipt_material, received_gross_weight, received_touch, received_fine,
        received_cash, received_price_override, received_value, rate_cut_fine, rate_cut_amount, rate_cut_adjusts_labour, rate_cut_booked_rate,
        discount_amount, net_total, entry_status, entered_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, 'pending')`,
    [
      billId,
      input.billNo,
      input.billDate,
      input.billType,
      customer.id,
      input.customer.name.trim(),
      input.customer.mobile.trim(),
      input.customer.address.trim(),
      parseAmount(input.customer.openingFineBalance),
      parseAmount(input.customer.openingLabourBalance),
      input.customer.openingNote?.trim() ?? '',
      input.language,
      subtotal,
      input.receiptType,
      input.receiptMaterial,
      parseAmount(input.receivedGrossWeight),
      parseAmount(input.receivedTouch),
      parseAmount(input.receivedFine),
      parseAmount(input.receivedCash),
      parseAmount(input.receivedPriceOverride),
      input.receivedValue,
      parseAmount(input.rateCutFine),
      parseAmount(input.rateCutAmount),
      input.rateCutAdjustsLabour ? 1 : 0,
      input.rateCutBookedRate,
      parseAmount(input.discountAmount),
      input.netTotal,
      timestamp,
    ],
  );

  for (const [index, item] of cleanItems.entries()) {
    await db.runAsync(
      `INSERT INTO bill_items
        (id, bill_id, line_no, material, item_name, weight, packet_less, touch, fine, pcs, rate, labour_type, labour, amount, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        createId('item'),
        billId,
        index + 1,
        item.material,
        item.itemName.trim(),
        item.weight.trim(),
        item.packetLess.trim(),
        item.touch.trim(),
        item.fine.trim(),
        item.pcs.trim(),
        item.rate.trim(),
        item.labourType ?? 'gw',
        item.labour.trim(),
        String(parseAmount(item.amount) || item.amount.trim()),
        timestamp,
      ],
    );
  }

  const row = await db.getFirstAsync<BillRow>('SELECT * FROM bills WHERE id = ?', [billId]);
  if (!row) {
    throw new Error('Bill could not be saved.');
  }

  return mapBill(row);
}

export async function updateBill(db: LocalDatabase, billId: string, input: BillSaveInput) {
  const timestamp = nowIso();
  const previousBill = await db.getFirstAsync<BillRow>('SELECT * FROM bills WHERE id = ?', [billId]);
  if (!previousBill) {
    throw new Error('Bill could not be updated.');
  }

  const previousItems = await db.getAllAsync<BillItemRow>(
    'SELECT * FROM bill_items WHERE bill_id = ? ORDER BY line_no ASC',
    [billId],
  );
  const cleanItems = input.items.filter((item) => item.itemName.trim());
  const subtotal = calculateSubtotal(cleanItems);
  const businessChanged = hasBusinessChanges(previousBill, previousItems, input, cleanItems, subtotal);
  const customerChanged =
    textValue(previousBill.customer_name) !== textValue(input.customer.name) ||
    textValue(previousBill.customer_mobile) !== textValue(input.customer.mobile) ||
    textValue(previousBill.customer_address) !== textValue(input.customer.address);
  const customer = customerChanged
    ? await upsertCustomer(db, billCustomerProfileDraft(input.customer))
    : { id: previousBill.customer_id };
  const nextEntryStatus = businessChanged ? 'pending' : previousBill.entry_status ?? 'pending';
  const nextEnteredAt = businessChanged ? '' : previousBill.entered_at ?? '';

  await db.runAsync(
    `UPDATE bills SET
       bill_no = ?,
       bill_date = ?,
       bill_type = ?,
       customer_id = ?,
       customer_name = ?,
       customer_mobile = ?,
       customer_address = ?,
       display_opening_fine_balance = ?,
       display_opening_labour_balance = ?,
       display_opening_note = ?,
       language = ?,
       subtotal = ?,
       receipt_type = ?,
       receipt_material = ?,
       received_gross_weight = ?,
       received_touch = ?,
       received_fine = ?,
        received_cash = ?,
        received_price_override = ?,
        received_value = ?,
        rate_cut_fine = ?,
        rate_cut_amount = ?,
        rate_cut_adjusts_labour = ?,
        rate_cut_booked_rate = ?,
        discount_amount = ?,
        net_total = ?,
       entry_status = ?,
       entered_at = ?,
       updated_at = ?,
       sync_status = 'pending'
     WHERE id = ?`,
    [
      input.billNo,
      input.billDate,
      input.billType,
      customer.id,
      input.customer.name.trim(),
      input.customer.mobile.trim(),
      input.customer.address.trim(),
      parseAmount(input.customer.openingFineBalance),
      parseAmount(input.customer.openingLabourBalance),
      input.customer.openingNote?.trim() ?? '',
      input.language,
      subtotal,
      input.receiptType,
      input.receiptMaterial,
      parseAmount(input.receivedGrossWeight),
      parseAmount(input.receivedTouch),
      parseAmount(input.receivedFine),
      parseAmount(input.receivedCash),
      parseAmount(input.receivedPriceOverride),
      input.receivedValue,
      parseAmount(input.rateCutFine),
      parseAmount(input.rateCutAmount),
      input.rateCutAdjustsLabour ? 1 : 0,
      input.rateCutBookedRate,
      parseAmount(input.discountAmount),
      input.netTotal,
      nextEntryStatus,
      nextEnteredAt,
      timestamp,
      billId,
    ],
  );

  if (!businessChanged) {
    const row = await db.getFirstAsync<BillRow>('SELECT * FROM bills WHERE id = ?', [billId]);
    if (!row) {
      throw new Error('Bill could not be updated.');
    }

    return mapBill(row);
  }

  await db.runAsync('DELETE FROM bill_items WHERE bill_id = ?', [billId]);

  for (const [index, item] of cleanItems.entries()) {
    await db.runAsync(
      `INSERT INTO bill_items
        (id, bill_id, line_no, material, item_name, weight, packet_less, touch, fine, pcs, rate, labour_type, labour, amount, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        createId('item'),
        billId,
        index + 1,
        item.material,
        item.itemName.trim(),
        item.weight.trim(),
        item.packetLess.trim(),
        item.touch.trim(),
        item.fine.trim(),
        item.pcs.trim(),
        item.rate.trim(),
        item.labourType ?? 'gw',
        item.labour.trim(),
        String(parseAmount(item.amount) || item.amount.trim()),
        timestamp,
      ],
    );
  }

  const row = await db.getFirstAsync<BillRow>('SELECT * FROM bills WHERE id = ?', [billId]);
  if (!row) {
    throw new Error('Bill could not be updated.');
  }

  return mapBill(row);
}

export async function getBillReminderForBill(db: LocalDatabase, billId: string) {
  const row = await db.getFirstAsync<BillReminderRow>('SELECT * FROM bill_reminders WHERE bill_id = ?', [billId]);
  return row ? mapBillReminder(row) : null;
}

export async function upsertBillReminder(
  db: LocalDatabase,
  input: {
    billId: string;
    billNo: number;
    customerName: string;
    customerMobile: string;
    dueAt: string;
    notificationId?: string;
  },
) {
  const timestamp = nowIso();
  const existing = await db.getFirstAsync<BillReminderRow>('SELECT * FROM bill_reminders WHERE bill_id = ?', [input.billId]);
  const id = existing?.id ?? createId('rem');
  const createdAt = existing?.created_at ?? timestamp;

  await db.runAsync(
    `INSERT OR REPLACE INTO bill_reminders
      (id, bill_id, bill_no, customer_name, customer_mobile, due_at, status, extended_count, notification_id, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 'pending')`,
    [
      id,
      input.billId,
      input.billNo,
      input.customerName.trim(),
      input.customerMobile.trim(),
      input.dueAt,
      existing?.extended_count ?? 0,
      input.notificationId ?? existing?.notification_id ?? '',
      createdAt,
      timestamp,
    ],
  );

  const row = await db.getFirstAsync<BillReminderRow>('SELECT * FROM bill_reminders WHERE id = ?', [id]);
  if (!row) {
    throw new Error('Reminder save nahi hua.');
  }

  return mapBillReminder(row);
}

export async function setBillReminderNotificationId(db: LocalDatabase, reminderId: string, notificationId: string) {
  await db.runAsync(
    "UPDATE bill_reminders SET notification_id = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [notificationId, nowIso(), reminderId],
  );
}

export async function extendBillReminder(db: LocalDatabase, reminderId: string, days: number) {
  const existing = await db.getFirstAsync<BillReminderRow>('SELECT * FROM bill_reminders WHERE id = ?', [reminderId]);
  if (!existing) {
    throw new Error('Reminder nahi mila.');
  }

  const baseTime = Math.max(new Date(existing.due_at).getTime(), Date.now());
  const dueDate = new Date(baseTime);
  dueDate.setDate(dueDate.getDate() + Math.max(days, 1));

  await db.runAsync(
    "UPDATE bill_reminders SET due_at = ?, status = 'active', extended_count = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [dueDate.toISOString(), Number(existing.extended_count ?? 0) + 1, nowIso(), reminderId],
  );

  const row = await db.getFirstAsync<BillReminderRow>('SELECT * FROM bill_reminders WHERE id = ?', [reminderId]);
  if (!row) {
    throw new Error('Reminder update nahi hua.');
  }

  return mapBillReminder(row);
}

export async function markBillReminderDone(db: LocalDatabase, reminderId: string) {
  await db.runAsync(
    "UPDATE bill_reminders SET status = 'done', updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [nowIso(), reminderId],
  );
}

export async function getBillReminders(db: LocalDatabase) {
  const rows = await db.getAllAsync<BillReminderRow>('SELECT * FROM bill_reminders ORDER BY due_at ASC');
  return rows.map(mapBillReminder);
}

export async function upsertMarketRun(
  db: LocalDatabase,
  input: { runDate: string; goldWeight?: string | number; silverWeight: string | number; note: string },
) {
  const timestamp = nowIso();
  const existing = await db.getFirstAsync<MarketRunRow>('SELECT * FROM market_runs WHERE run_date = ?', [input.runDate]);
  const id = existing?.id ?? createId('mrun');
  const createdAt = existing?.created_at ?? timestamp;

  await db.runAsync(
    `INSERT OR REPLACE INTO market_runs
      (id, run_date, gold_weight, silver_weight, note, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      input.runDate,
      parseAmount(input.goldWeight),
      parseAmount(input.silverWeight),
      input.note.trim(),
      createdAt,
      timestamp,
    ],
  );

  const row = await db.getFirstAsync<MarketRunRow>('SELECT * FROM market_runs WHERE id = ?', [id]);
  if (!row) {
    throw new Error('Market stock save nahi hua.');
  }

  return mapMarketRun(row);
}

export async function getMarketStockSummaries(db: LocalDatabase): Promise<MarketStockSummary[]> {
  const [runs, bills, itemRows] = await Promise.all([
    db.getAllAsync<MarketRunRow>('SELECT * FROM market_runs ORDER BY run_date DESC'),
    db.getAllAsync<BillRow>('SELECT * FROM bills ORDER BY bill_date DESC, bill_no DESC'),
    db.getAllAsync<BillItemRow>('SELECT * FROM bill_items ORDER BY bill_id ASC, line_no ASC'),
  ]);
  const billById = new Map(bills.map((bill) => [bill.id, bill]));
  const soldByDate = new Map<string, { billIds: Set<string>; goldSold: number; silverSold: number }>();

  for (const item of itemRows) {
    const bill = billById.get(item.bill_id);
    if (!bill) {
      continue;
    }

    const summary = soldByDate.get(bill.bill_date) ?? { billIds: new Set<string>(), goldSold: 0, silverSold: 0 };
    const soldWeight = calculateNetWeight(item.weight, item.packet_less ?? '');
    if (item.material === 'silver') {
      summary.silverSold += soldWeight;
    } else {
      summary.goldSold += soldWeight;
    }
    summary.billIds.add(bill.id);
    soldByDate.set(bill.bill_date, summary);
  }

  return runs.map((row) => {
    const run = mapMarketRun(row);
    const sold = soldByDate.get(run.runDate) ?? { billIds: new Set<string>(), goldSold: 0, silverSold: 0 };
    return {
      ...run,
      billCount: sold.billIds.size,
      goldSold: sold.goldSold,
      silverSold: sold.silverSold,
      goldRemaining: Math.max(run.goldWeight - sold.goldSold, 0),
      silverRemaining: Math.max(run.silverWeight - sold.silverSold, 0),
    };
  });
}

export async function createBillTransaction(
  db: LocalDatabase,
  input: {
    billId: string;
    transactionDate: string;
    mode: BillTransactionMode;
    cashAmount: string | number;
    bankAmount: string | number;
    fineWeight: string | number;
    rateCutFine: string | number;
    rateCutAmount: string | number;
    bookedRate: string | number;
    note: string;
  },
) {
  const timestamp = nowIso();
  const id = createId('txn');
  const material = 'material' in input ? input.material ?? 'silver' : 'silver';
  const amount = 'amount' in input ? parseAmount(input.amount) : 0;
  await db.runAsync(
    `INSERT INTO bill_transactions
      (id, bill_id, transaction_date, mode, cash_amount, bank_amount, fine_weight, rate_cut_fine, rate_cut_amount,
       booked_rate, material, amount, note, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      input.billId,
      input.transactionDate,
      input.mode,
      parseAmount(input.cashAmount),
      parseAmount(input.bankAmount),
      roundFineToHalfGram(parseAmount(input.fineWeight)),
      roundFineToHalfGram(parseAmount(input.rateCutFine)),
      parseAmount(input.rateCutAmount),
      parseAmount(input.bookedRate),
      material,
      amount,
      input.note.trim(),
      timestamp,
      timestamp,
    ],
  );

  const rows = await db.getAllAsync<BillTransactionRow>('SELECT * FROM bill_transactions WHERE bill_id = ? ORDER BY transaction_date DESC, updated_at DESC', [
    input.billId,
  ]);
  const row = rows.find((transaction) => transaction.id === id);
  if (!row) {
    throw new Error('Transaction save nahi hua.');
  }

  return mapBillTransaction(row);
}

export async function getBillTransactions(db: LocalDatabase, billId: string) {
  const rows = await db.getAllAsync<BillTransactionRow>(
    'SELECT * FROM bill_transactions WHERE bill_id = ? ORDER BY transaction_date DESC, updated_at DESC',
    [billId],
  );
  return rows.map(mapBillTransaction);
}

export async function getAllBillTransactions(db: LocalDatabase) {
  const rows = await db.getAllAsync<BillTransactionRow>(
    'SELECT * FROM bill_transactions ORDER BY transaction_date DESC, updated_at DESC',
  );
  return rows.map(mapBillTransaction);
}

function fineValueFromRate(material: MetalType, fineWeight: string | number, bookedRate: string | number) {
  const fine = parseAmount(fineWeight);
  const rate = parseAmount(bookedRate);
  if (fine <= 0 || rate <= 0) {
    return 0;
  }

  return (fine * rate) / 1000;
}

export async function createPartyTransaction(
  db: LocalDatabase,
  input: {
    customerId: string;
    transactionDate: string;
    mode: PartyTransactionMode;
    material: MetalType;
    cashAmount: string | number;
    bankAmount: string | number;
    fineWeight: string | number;
    bookedRate: string | number;
    paymentAmount: string | number;
    discountAmount: string | number;
    note: string;
  },
) {
  const timestamp = nowIso();
  const id = createId('ptxn');
  const voucherNo = await getNextVoucherNo(db);
  const fineWeight = roundFineToHalfGram(parseAmount(input.fineWeight));
  const bookedRate = parseAmount(input.bookedRate);
  const fineValue = fineValueFromRate(input.material, fineWeight, bookedRate);

  await db.runAsync(
    `INSERT INTO party_transactions
      (id, customer_id, voucher_no, transaction_date, mode, material, cash_amount, bank_amount, fine_weight,
       booked_rate, fine_value, payment_amount, discount_amount, note, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      input.customerId,
      voucherNo,
      input.transactionDate,
      input.mode,
      input.material,
      parseAmount(input.cashAmount),
      parseAmount(input.bankAmount),
      fineWeight,
      bookedRate,
      fineValue,
      parseAmount(input.paymentAmount),
      parseAmount(input.discountAmount),
      input.note.trim(),
      timestamp,
      timestamp,
    ],
  );

  const row = await db.getFirstAsync<PartyTransactionRow>('SELECT * FROM party_transactions WHERE id = ?', [id]);
  if (!row) {
    throw new Error('Party transaction save nahi hua.');
  }

  return mapPartyTransaction(row);
}

export async function getPartyTransactions(db: LocalDatabase, customerId: string) {
  const rows = await db.getAllAsync<PartyTransactionRow>(
    'SELECT * FROM party_transactions WHERE customer_id = ? ORDER BY transaction_date DESC, voucher_no DESC',
    [customerId],
  );
  return rows.map(mapPartyTransaction);
}

export async function getAllPartyTransactions(db: LocalDatabase) {
  const rows = await db.getAllAsync<PartyTransactionRow>(
    'SELECT * FROM party_transactions ORDER BY transaction_date DESC, voucher_no DESC',
  );
  return rows.map(mapPartyTransaction);
}

async function ensureSupplierStorage(db: LocalDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS supplier_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      entry_date TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      mobile TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      opening_fine_payable REAL NOT NULL DEFAULT 0,
      opening_amount_payable REAL NOT NULL DEFAULT 0,
      opening_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS supplier_accounts_mobile_idx ON supplier_accounts(mobile);

    CREATE TABLE IF NOT EXISTS supplier_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      supplier_id TEXT NOT NULL,
      voucher_no INTEGER NOT NULL UNIQUE,
      transaction_date TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'purchase',
      material TEXT NOT NULL DEFAULT 'silver',
      fine_weight REAL NOT NULL DEFAULT 0,
      booked_rate REAL NOT NULL DEFAULT 0,
      fine_value REAL NOT NULL DEFAULT 0,
      cash_amount REAL NOT NULL DEFAULT 0,
      bank_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (supplier_id) REFERENCES supplier_accounts(id) ON DELETE CASCADE
    );

  CREATE INDEX IF NOT EXISTS supplier_transactions_supplier_id_idx ON supplier_transactions(supplier_id);
  `);

  try {
    await db.execAsync(`
      ALTER TABLE supplier_accounts ADD COLUMN entry_date TEXT NOT NULL DEFAULT '';
      UPDATE supplier_accounts SET entry_date = substr(created_at, 1, 10) WHERE COALESCE(entry_date, '') = '';
    `);
  } catch {
    // Column already exists on migrated databases.
  }
}

export async function saveSupplier(
  db: LocalDatabase,
  draft: {
    id?: string;
    entryDate?: string;
    name: string;
    mobile: string;
    address: string;
    openingFinePayable: string | number;
    openingAmountPayable: string | number;
    openingNote: string;
  },
) {
  if (!draft.name.trim()) {
    throw new Error('Supplier name required.');
  }

  await ensureSupplierStorage(db);
  const timestamp = nowIso();
  const selectedId = draft.id?.trim();
  const trimmedMobile = draft.mobile.trim();
  const existing = selectedId
    ? await db.getFirstAsync<SupplierAccountRow>('SELECT * FROM supplier_accounts WHERE id = ?', [selectedId])
    : trimmedMobile
    ? await db.getFirstAsync<SupplierAccountRow>('SELECT * FROM supplier_accounts WHERE mobile = ? ORDER BY updated_at DESC', [trimmedMobile])
    : null;
  const id = existing?.id ?? selectedId ?? createId('sup');
  const createdAt = existing?.created_at ?? timestamp;
  const entryDate = draft.entryDate?.trim() || existing?.entry_date || localIsoDate();

  await db.runAsync(
    `INSERT OR REPLACE INTO supplier_accounts
      (id, entry_date, name, mobile, address, opening_fine_payable, opening_amount_payable, opening_note, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      entryDate,
      draft.name.trim(),
      trimmedMobile,
      draft.address.trim(),
      parseAmount(draft.openingFinePayable),
      parseAmount(draft.openingAmountPayable),
      draft.openingNote.trim(),
      createdAt,
      timestamp,
    ],
  );

  const row = await db.getFirstAsync<SupplierAccountRow>('SELECT * FROM supplier_accounts WHERE id = ?', [id]);
  if (!row) {
    throw new Error('Supplier save nahi hua.');
  }

  return mapSupplierAccount(row);
}

export async function createSupplierTransaction(
  db: LocalDatabase,
  input: {
    supplierId: string;
    transactionDate: string;
    mode: SupplierTransactionMode;
    material: MetalType;
    fineWeight: string | number;
    bookedRate: string | number;
    cashAmount: string | number;
    bankAmount: string | number;
    discountAmount: string | number;
    note: string;
  },
) {
  await ensureSupplierStorage(db);
  const timestamp = nowIso();
  const id = createId('stxn');
  const voucherNo = await getNextSupplierVoucherNo(db);
  const fineWeight = roundFineToHalfGram(parseAmount(input.fineWeight));
  const bookedRate = parseAmount(input.bookedRate);
  const fineValue = fineValueFromRate(input.material, fineWeight, bookedRate);

  await db.runAsync(
    `INSERT INTO supplier_transactions
      (id, supplier_id, voucher_no, transaction_date, mode, material, fine_weight, booked_rate,
       fine_value, cash_amount, bank_amount, discount_amount, note, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      input.supplierId,
      voucherNo,
      input.transactionDate,
      input.mode,
      input.material,
      fineWeight,
      bookedRate,
      fineValue,
      parseAmount(input.cashAmount),
      parseAmount(input.bankAmount),
      parseAmount(input.discountAmount),
      input.note.trim(),
      timestamp,
      timestamp,
    ],
  );

  const row = await db.getFirstAsync<SupplierTransactionRow>('SELECT * FROM supplier_transactions WHERE id = ?', [id]);
  if (!row) {
    throw new Error('Supplier transaction save nahi hua.');
  }

  return mapSupplierTransaction(row);
}

export async function getSupplierAccounts(db: LocalDatabase) {
  const rows = await db.getAllAsync<SupplierAccountRow>('SELECT * FROM supplier_accounts ORDER BY updated_at DESC, name ASC');
  return rows.map(mapSupplierAccount);
}

export async function getSupplierTransactions(db: LocalDatabase, supplierId: string) {
  const rows = await db.getAllAsync<SupplierTransactionRow>(
    'SELECT * FROM supplier_transactions WHERE supplier_id = ? ORDER BY transaction_date DESC, voucher_no DESC',
    [supplierId],
  );
  return rows.map(mapSupplierTransaction);
}

export async function getAllSupplierTransactions(db: LocalDatabase) {
  const rows = await db.getAllAsync<SupplierTransactionRow>(
    'SELECT * FROM supplier_transactions ORDER BY transaction_date DESC, voucher_no DESC',
  );
  return rows.map(mapSupplierTransaction);
}

export async function createCashBankEntry(
  db: LocalDatabase,
  input: {
    entryDate: string;
    mode: LedgerMode;
    particular: string;
    party?: string;
    receiptAmount: string | number;
    paymentAmount: string | number;
  },
) {
  const receiptAmount = parseAmount(input.receiptAmount);
  const paymentAmount = parseAmount(input.paymentAmount);
  if (receiptAmount <= 0 && paymentAmount <= 0) {
    throw new Error('Receipt ya payment amount required.');
  }

  const timestamp = nowIso();
  const id = createId('cble');
  await db.runAsync(
    `INSERT INTO cash_bank_entries
      (id, entry_date, mode, particular, party, receipt_amount, payment_amount, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      input.entryDate || localIsoDate(),
      input.mode,
      input.particular.trim() || 'Manual ledger entry',
      input.party?.trim() || 'Manual',
      receiptAmount,
      paymentAmount,
      timestamp,
      timestamp,
    ],
  );

  const row = await db.getFirstAsync<CashBankEntryRow>('SELECT * FROM cash_bank_entries WHERE id = ?', [id]);
  if (!row) {
    throw new Error('Ledger entry save nahi hui.');
  }
  return mapCashBankEntry(row);
}

export async function getAllCashBankEntries(db: LocalDatabase) {
  const rows = await db.getAllAsync<CashBankEntryRow>('SELECT * FROM cash_bank_entries ORDER BY entry_date DESC, updated_at DESC');
  return rows.map(mapCashBankEntry);
}

export async function getSupplierLedgerSummaries(db: LocalDatabase) {
  const [suppliers, transactions] = await Promise.all([
    db.getAllAsync<SupplierAccountRow>('SELECT * FROM supplier_accounts ORDER BY name ASC'),
    db.getAllAsync<SupplierTransactionRow>('SELECT * FROM supplier_transactions ORDER BY transaction_date DESC, voucher_no DESC'),
  ]);
  const ledgers = new Map<string, SupplierLedgerSummary>();

  for (const supplier of suppliers) {
    ledgers.set(supplier.id, {
      amountPaid: 0,
      amountPayable: Number(supplier.opening_amount_payable ?? 0),
      discountAmount: 0,
      finePayable: Number(supplier.opening_fine_payable ?? 0),
      lastTransactionDate: supplier.updated_at,
      metalPaid: 0,
      openingAmountPayable: Number(supplier.opening_amount_payable ?? 0),
      openingFinePayable: Number(supplier.opening_fine_payable ?? 0),
      purchaseAmount: 0,
      purchaseFine: 0,
      supplierId: supplier.id,
      transactionCount: 0,
    });
  }

  for (const transaction of transactions) {
    const existing =
      ledgers.get(transaction.supplier_id) ??
      ({
        amountPaid: 0,
        amountPayable: 0,
        discountAmount: 0,
        finePayable: 0,
        lastTransactionDate: transaction.transaction_date,
        metalPaid: 0,
        openingAmountPayable: 0,
        openingFinePayable: 0,
        purchaseAmount: 0,
        purchaseFine: 0,
        supplierId: transaction.supplier_id,
        transactionCount: 0,
      } satisfies SupplierLedgerSummary);
    const fine = Number(transaction.fine_weight ?? 0);
    const cashBank = Number(transaction.cash_amount ?? 0) + Number(transaction.bank_amount ?? 0);
    const discount = Number(transaction.discount_amount ?? 0);
    existing.transactionCount += 1;
    if (transaction.mode === 'purchase') {
      existing.purchaseFine += fine;
      existing.purchaseAmount += Number(transaction.fine_value ?? 0);
      existing.finePayable += fine;
      existing.amountPayable += Number(transaction.fine_value ?? 0);
    } else if (transaction.mode === 'metal_paid') {
      existing.metalPaid += fine;
      existing.finePayable -= fine;
    } else {
      existing.amountPaid += cashBank;
      existing.discountAmount += discount;
      existing.amountPayable -= cashBank + discount;
    }
    if (transaction.transaction_date > existing.lastTransactionDate) {
      existing.lastTransactionDate = transaction.transaction_date;
    }
    ledgers.set(transaction.supplier_id, existing);
  }

  return [...ledgers.values()]
    .map((ledger) => ({
      ...ledger,
      amountPayable: Math.max(Number(ledger.amountPayable.toFixed(2)), 0),
      finePayable: Math.max(Number(ledger.finePayable.toFixed(3)), 0),
    }))
    .sort((a, b) => b.lastTransactionDate.localeCompare(a.lastTransactionDate));
}

export async function getRecentBills(db: LocalDatabase) {
  const rows = await db.getAllAsync<BillRow>(
    'SELECT * FROM bills ORDER BY bill_no DESC LIMIT 8',
  );
  const itemRows = await db.getAllAsync<BillItemRow>('SELECT * FROM bill_items ORDER BY bill_id ASC, line_no ASC');
  const transactionRows = await db.getAllAsync<BillTransactionRow>(
    'SELECT * FROM bill_transactions ORDER BY transaction_date DESC, updated_at DESC',
  );
  const groupedItems = groupItemsByBillId(itemRows);
  const groupedTransactions = groupTransactionsByBillId(transactionRows);

  return rows.map((row): RecentBill => {
    const bill = mapBill(row);
    const money = resolveBillListMoney(row, groupedItems.get(row.id) ?? [], groupedTransactions.get(row.id) ?? []);
    return {
      id: bill.id,
      billNo: bill.billNo,
      billDate: bill.billDate,
      billType: bill.billType,
      customerAddress: bill.customerAddress,
      customerId: bill.customerId,
      customerName: bill.customerName,
      customerMobile: bill.customerMobile,
      subtotal: money.subtotal,
      netTotal: money.netTotal,
      entryStatus: bill.entryStatus,
      syncStatus: bill.syncStatus,
    };
  });
}

export async function getBackupData(db: LocalDatabase) {
  const [
    rates,
    customers,
    itemNames,
    billReminders,
    marketRuns,
    bills,
    billItems,
    billTransactions,
    partyTransactions,
    supplierAccounts,
    supplierTransactions,
    cashBankEntries,
  ] = await Promise.all([
    db.getAllAsync<RateRow>('SELECT * FROM rates ORDER BY rate_date DESC'),
    db.getAllAsync<CustomerRow>('SELECT * FROM customers ORDER BY updated_at DESC'),
    db.getAllAsync<ItemNameRow>('SELECT * FROM item_names ORDER BY name ASC'),
    db.getAllAsync<BillReminderRow>('SELECT * FROM bill_reminders ORDER BY due_at ASC'),
    db.getAllAsync<MarketRunRow>('SELECT * FROM market_runs ORDER BY run_date DESC'),
    db.getAllAsync<BillRow>('SELECT * FROM bills ORDER BY bill_date DESC, bill_no DESC'),
    db.getAllAsync<BillItemRow>('SELECT * FROM bill_items ORDER BY bill_id ASC, line_no ASC'),
    db.getAllAsync<BillTransactionRow>('SELECT * FROM bill_transactions ORDER BY transaction_date DESC, updated_at DESC'),
    db.getAllAsync<PartyTransactionRow>('SELECT * FROM party_transactions ORDER BY transaction_date DESC, voucher_no DESC'),
    db.getAllAsync<SupplierAccountRow>('SELECT * FROM supplier_accounts ORDER BY updated_at DESC'),
    db.getAllAsync<SupplierTransactionRow>('SELECT * FROM supplier_transactions ORDER BY transaction_date DESC, voucher_no DESC'),
    db.getAllAsync<CashBankEntryRow>('SELECT * FROM cash_bank_entries ORDER BY entry_date DESC, updated_at DESC'),
  ]);

  return {
    exportedAt: nowIso(),
    version: DATABASE_VERSION,
    rates,
    customers,
    itemNames,
    billReminders,
    marketRuns,
    bills,
    billItems,
    billTransactions,
    partyTransactions,
    supplierAccounts,
    supplierTransactions,
    cashBankEntries,
  };
}

type BackupRow = Record<string, unknown>;

function backupRows(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return Array.isArray(value) ? value.filter((row): row is BackupRow => !!row && typeof row === 'object') : [];
}

function backupText(row: BackupRow, key: string, fallback = '') {
  const value = row[key];
  return value === null || value === undefined ? fallback : String(value);
}

function backupNumber(row: BackupRow, key: string, fallback = 0) {
  const value = Number(row[key] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function backupOneOf<T extends string>(row: BackupRow, key: string, allowed: readonly T[], fallback: T) {
  const value = backupText(row, key);
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function restoreBackupData(db: LocalDatabase, backup: unknown) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Backup file invalid hai.');
  }

  const source = backup as Record<string, unknown>;
  const rates = backupRows(source, 'rates');
  const customers = backupRows(source, 'customers');
  const itemNames = backupRows(source, 'itemNames').length ? backupRows(source, 'itemNames') : backupRows(source, 'item_names');
  const billReminders = backupRows(source, 'billReminders').length
    ? backupRows(source, 'billReminders')
    : backupRows(source, 'bill_reminders');
  const marketRuns = backupRows(source, 'marketRuns').length ? backupRows(source, 'marketRuns') : backupRows(source, 'market_runs');
  const bills = backupRows(source, 'bills');
  const billItems = backupRows(source, 'billItems').length ? backupRows(source, 'billItems') : backupRows(source, 'bill_items');
  const billTransactions = backupRows(source, 'billTransactions').length
    ? backupRows(source, 'billTransactions')
    : backupRows(source, 'bill_transactions');
  const partyTransactions = backupRows(source, 'partyTransactions').length
    ? backupRows(source, 'partyTransactions')
    : backupRows(source, 'party_transactions');
  const supplierAccounts = backupRows(source, 'supplierAccounts').length
    ? backupRows(source, 'supplierAccounts')
    : backupRows(source, 'supplier_accounts');
  const supplierTransactions = backupRows(source, 'supplierTransactions').length
    ? backupRows(source, 'supplierTransactions')
    : backupRows(source, 'supplier_transactions');
  const cashBankEntries = backupRows(source, 'cashBankEntries').length
    ? backupRows(source, 'cashBankEntries')
    : backupRows(source, 'cash_bank_entries');

  if (
    !rates.length &&
    !customers.length &&
    !itemNames.length &&
    !billReminders.length &&
    !marketRuns.length &&
    !bills.length &&
    !billItems.length &&
    !billTransactions.length &&
    !partyTransactions.length &&
    !supplierAccounts.length &&
    !supplierTransactions.length &&
    !cashBankEntries.length
  ) {
    throw new Error('Backup file me app data nahi mila.');
  }

  await db.runAsync('DELETE FROM supplier_transactions');
  await db.runAsync('DELETE FROM cash_bank_entries');
  await db.runAsync('DELETE FROM supplier_accounts');
  await db.runAsync('DELETE FROM party_transactions');
  await db.runAsync('DELETE FROM bill_transactions');
  await db.runAsync('DELETE FROM bill_reminders');
  await db.runAsync('DELETE FROM bill_items');
  await db.runAsync('DELETE FROM bills');
  await db.runAsync('DELETE FROM market_runs');
  await db.runAsync('DELETE FROM item_names');
  await db.runAsync('DELETE FROM customers');
  await db.runAsync('DELETE FROM rates');

  for (const rate of rates) {
    await db.runAsync(
      `INSERT OR REPLACE INTO rates
        (id, rate_date, gold_10g_rate, silver_1kg_rate, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(rate, 'id') || createId('rate'),
        backupText(rate, 'rate_date') || localIsoDate(),
        backupNumber(rate, 'gold_10g_rate'),
        backupNumber(rate, 'silver_1kg_rate'),
        backupText(rate, 'updated_at') || nowIso(),
      ],
    );
  }

  for (const customer of customers) {
    const timestamp = backupText(customer, 'updated_at') || nowIso();
    await db.runAsync(
      `INSERT OR REPLACE INTO customers
        (id, name, mobile, address, opening_fine_balance, opening_labour_balance, opening_note, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(customer, 'id') || createId('cust'),
        backupText(customer, 'name'),
        backupText(customer, 'mobile'),
        backupText(customer, 'address'),
        backupNumber(customer, 'opening_fine_balance'),
        backupNumber(customer, 'opening_labour_balance'),
        backupText(customer, 'opening_note'),
        backupText(customer, 'created_at') || timestamp,
        timestamp,
      ],
    );
  }

  for (const supplier of supplierAccounts) {
    const timestamp = backupText(supplier, 'updated_at') || nowIso();
    await db.runAsync(
      `INSERT OR REPLACE INTO supplier_accounts
        (id, entry_date, name, mobile, address, opening_fine_payable, opening_amount_payable, opening_note, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(supplier, 'id') || createId('sup'),
        backupText(supplier, 'entry_date') || backupText(supplier, 'entryDate') || localIsoDate(),
        backupText(supplier, 'name'),
        backupText(supplier, 'mobile'),
        backupText(supplier, 'address'),
        backupNumber(supplier, 'opening_fine_payable'),
        backupNumber(supplier, 'opening_amount_payable'),
        backupText(supplier, 'opening_note'),
        backupText(supplier, 'created_at') || timestamp,
        timestamp,
      ],
    );
  }

  for (const itemName of itemNames) {
    await db.runAsync(
      `INSERT OR REPLACE INTO item_names
        (id, name, material, updated_at, sync_status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [
        backupText(itemName, 'id') || createId('iname'),
        backupText(itemName, 'name'),
        backupOneOf<MetalType>(itemName, 'material', ['silver'], 'silver'),
        backupText(itemName, 'updated_at') || nowIso(),
      ],
    );
  }

  for (const bill of bills) {
    await db.runAsync(
      `INSERT OR REPLACE INTO bills
        (id, bill_no, bill_date, bill_type, customer_id, customer_name, customer_mobile, customer_address,
         display_opening_fine_balance, display_opening_labour_balance, display_opening_note,
         language, subtotal, receipt_type, receipt_material, received_gross_weight, received_touch, received_fine,
         received_cash, received_price_override, received_value, rate_cut_fine, rate_cut_amount, rate_cut_adjusts_labour, rate_cut_booked_rate,
         discount_amount, net_total, entry_status, entered_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(bill, 'id') || createId('bill'),
        backupNumber(bill, 'bill_no', 101),
        backupText(bill, 'bill_date') || localIsoDate(),
        backupOneOf<BillType>(bill, 'bill_type', ['estimate', 'jangad'], 'estimate'),
        backupText(bill, 'customer_id'),
        backupText(bill, 'customer_name'),
        backupText(bill, 'customer_mobile'),
        backupText(bill, 'customer_address'),
        backupNumber(bill, 'display_opening_fine_balance'),
        backupNumber(bill, 'display_opening_labour_balance'),
        backupText(bill, 'display_opening_note'),
        backupOneOf<Language>(bill, 'language', ['en', 'hi', 'gu'], 'en'),
        backupNumber(bill, 'subtotal'),
        backupOneOf<ReceiptType>(bill, 'receipt_type', ['none', 'fine', 'cash', 'fine_cash'], 'none'),
        backupOneOf<MetalType>(bill, 'receipt_material', ['silver'], 'silver'),
        backupNumber(bill, 'received_gross_weight'),
        backupNumber(bill, 'received_touch'),
        backupNumber(bill, 'received_fine'),
        backupNumber(bill, 'received_cash'),
        backupNumber(bill, 'received_price_override'),
        backupNumber(bill, 'received_value'),
        backupNumber(bill, 'rate_cut_fine'),
        backupNumber(bill, 'rate_cut_amount'),
        backupNumber(bill, 'rate_cut_adjusts_labour', 1),
        backupNumber(bill, 'rate_cut_booked_rate'),
        backupNumber(bill, 'discount_amount'),
        backupNumber(bill, 'net_total'),
        backupOneOf<OfficeEntryStatus>(bill, 'entry_status', ['pending', 'entered'], 'pending'),
        backupText(bill, 'entered_at'),
        backupText(bill, 'updated_at') || nowIso(),
      ],
    );
  }

  for (const reminder of billReminders) {
    await db.runAsync(
      `INSERT OR REPLACE INTO bill_reminders
        (id, bill_id, bill_no, customer_name, customer_mobile, due_at, status, extended_count, notification_id,
         created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(reminder, 'id') || createId('rem'),
        backupText(reminder, 'bill_id'),
        backupNumber(reminder, 'bill_no'),
        backupText(reminder, 'customer_name'),
        backupText(reminder, 'customer_mobile'),
        backupText(reminder, 'due_at') || nowIso(),
        backupOneOf<ReminderStatus>(reminder, 'status', ['active', 'done'], 'active'),
        backupNumber(reminder, 'extended_count'),
        backupText(reminder, 'notification_id'),
        backupText(reminder, 'created_at') || nowIso(),
        backupText(reminder, 'updated_at') || nowIso(),
      ],
    );
  }

  for (const marketRun of marketRuns) {
    const timestamp = backupText(marketRun, 'updated_at') || nowIso();
    await db.runAsync(
      `INSERT OR REPLACE INTO market_runs
        (id, run_date, gold_weight, silver_weight, note, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(marketRun, 'id') || createId('mrun'),
        backupText(marketRun, 'run_date') || localIsoDate(),
        backupNumber(marketRun, 'gold_weight'),
        backupNumber(marketRun, 'silver_weight'),
        backupText(marketRun, 'note'),
        backupText(marketRun, 'created_at') || timestamp,
        timestamp,
      ],
    );
  }

  let restoredItems = 0;
  for (const item of billItems) {
    const billId = backupText(item, 'bill_id');
    if (!billId) {
      continue;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO bill_items
        (id, bill_id, line_no, material, item_name, weight, packet_less, touch, fine, pcs, rate, labour_type,
         labour, amount, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(item, 'id') || createId('item'),
        billId,
        backupNumber(item, 'line_no', restoredItems + 1),
        backupOneOf<MetalType>(item, 'material', ['silver'], 'silver'),
        backupText(item, 'item_name'),
        backupText(item, 'weight'),
        backupText(item, 'packet_less'),
        backupText(item, 'touch'),
        backupText(item, 'fine'),
        backupText(item, 'pcs'),
        backupText(item, 'rate'),
        backupOneOf<LabourType>(item, 'labour_type', ['gw', 'pcs'], 'gw'),
        backupText(item, 'labour'),
        backupText(item, 'amount'),
        backupText(item, 'updated_at') || nowIso(),
      ],
    );
    restoredItems += 1;
  }

  let restoredTransactions = 0;
  for (const transaction of billTransactions) {
    const billId = backupText(transaction, 'bill_id');
    if (!billId) {
      continue;
    }

    const timestamp = backupText(transaction, 'updated_at') || nowIso();
    await db.runAsync(
      `INSERT OR REPLACE INTO bill_transactions
        (id, bill_id, transaction_date, mode, cash_amount, bank_amount, fine_weight, rate_cut_fine,
         rate_cut_amount, booked_rate, note, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(transaction, 'id') || createId('txn'),
        billId,
        backupText(transaction, 'transaction_date') || localIsoDate(),
        backupOneOf<BillTransactionMode>(transaction, 'mode', ['cash', 'bank', 'split', 'fine', 'rate_cut'], 'cash'),
        backupNumber(transaction, 'cash_amount'),
        backupNumber(transaction, 'bank_amount'),
        backupNumber(transaction, 'fine_weight'),
        backupNumber(transaction, 'rate_cut_fine'),
        backupNumber(transaction, 'rate_cut_amount'),
        backupNumber(transaction, 'booked_rate'),
        backupText(transaction, 'note'),
        backupText(transaction, 'created_at') || timestamp,
        timestamp,
      ],
    );
    restoredTransactions += 1;
  }

  let restoredPartyTransactions = 0;
  for (const transaction of partyTransactions) {
    const customerId = backupText(transaction, 'customer_id');
    if (!customerId) {
      continue;
    }

    const timestamp = backupText(transaction, 'updated_at') || nowIso();
    await db.runAsync(
      `INSERT OR REPLACE INTO party_transactions
        (id, customer_id, voucher_no, transaction_date, mode, material, cash_amount, bank_amount, fine_weight,
         booked_rate, fine_value, payment_amount, discount_amount, note, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(transaction, 'id') || createId('ptxn'),
        customerId,
        backupNumber(transaction, 'voucher_no', restoredPartyTransactions + 1),
        backupText(transaction, 'transaction_date') || localIsoDate(),
        backupOneOf<PartyTransactionMode>(transaction, 'mode', ['cash', 'bank', 'split', 'fine', 'payment', 'discount'], 'cash'),
        backupOneOf<MetalType>(transaction, 'material', ['silver'], 'silver'),
        backupNumber(transaction, 'cash_amount'),
        backupNumber(transaction, 'bank_amount'),
        backupNumber(transaction, 'fine_weight'),
        backupNumber(transaction, 'booked_rate'),
        backupNumber(transaction, 'fine_value'),
        backupNumber(transaction, 'payment_amount'),
        backupNumber(transaction, 'discount_amount'),
        backupText(transaction, 'note'),
        backupText(transaction, 'created_at') || timestamp,
        timestamp,
      ],
    );
    restoredPartyTransactions += 1;
  }

  let restoredSupplierTransactions = 0;
  for (const transaction of supplierTransactions) {
    const supplierId = backupText(transaction, 'supplier_id');
    if (!supplierId) {
      continue;
    }

    const timestamp = backupText(transaction, 'updated_at') || nowIso();
    await db.runAsync(
      `INSERT OR REPLACE INTO supplier_transactions
        (id, supplier_id, voucher_no, transaction_date, mode, material, fine_weight, booked_rate,
         fine_value, cash_amount, bank_amount, discount_amount, note, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(transaction, 'id') || createId('stxn'),
        supplierId,
        backupNumber(transaction, 'voucher_no', restoredSupplierTransactions + 1),
        backupText(transaction, 'transaction_date') || localIsoDate(),
        backupOneOf<SupplierTransactionMode>(
          transaction,
          'mode',
          ['purchase', 'cash_payment', 'bank_payment', 'split_payment', 'metal_paid', 'discount'],
          'purchase',
        ),
        backupOneOf<MetalType>(transaction, 'material', ['silver'], 'silver'),
        backupNumber(transaction, 'fine_weight'),
        backupNumber(transaction, 'booked_rate'),
        backupNumber(transaction, 'fine_value'),
        backupNumber(transaction, 'cash_amount'),
        backupNumber(transaction, 'bank_amount'),
        backupNumber(transaction, 'discount_amount'),
        backupText(transaction, 'note'),
        backupText(transaction, 'created_at') || timestamp,
        timestamp,
      ],
    );
    restoredSupplierTransactions += 1;
  }

  let restoredCashBankEntries = 0;
  for (const entry of cashBankEntries) {
    const timestamp = backupText(entry, 'updated_at') || nowIso();
    await db.runAsync(
      `INSERT OR REPLACE INTO cash_bank_entries
        (id, entry_date, mode, particular, party, receipt_amount, payment_amount, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        backupText(entry, 'id') || createId('cble'),
        backupText(entry, 'entry_date') || localIsoDate(),
        backupOneOf<LedgerMode>(entry, 'mode', ['cash', 'bank'], 'cash'),
        backupText(entry, 'particular') || 'Manual ledger entry',
        backupText(entry, 'party') || 'Manual',
        backupNumber(entry, 'receipt_amount'),
        backupNumber(entry, 'payment_amount'),
        backupText(entry, 'created_at') || timestamp,
        timestamp,
      ],
    );
    restoredCashBankEntries += 1;
  }

  return {
    billItems: restoredItems,
    billReminders: billReminders.length,
    billTransactions: restoredTransactions,
    bills: bills.length,
    customers: customers.length,
    itemNames: itemNames.length,
    marketRuns: marketRuns.length,
    partyTransactions: restoredPartyTransactions,
    rates: rates.length,
    supplierAccounts: supplierAccounts.length,
    supplierTransactions: restoredSupplierTransactions,
    cashBankEntries: restoredCashBankEntries,
  };
}

export async function getAllBills(db: LocalDatabase) {
  const rows = await db.getAllAsync<BillRow>('SELECT * FROM bills ORDER BY bill_date DESC, bill_no DESC');
  const itemRows = await db.getAllAsync<BillItemRow>('SELECT * FROM bill_items ORDER BY bill_id ASC, line_no ASC');
  const transactionRows = await db.getAllAsync<BillTransactionRow>(
    'SELECT * FROM bill_transactions ORDER BY transaction_date DESC, updated_at DESC',
  );
  const groupedItems = groupItemsByBillId(itemRows);
  const groupedTransactions = groupTransactionsByBillId(transactionRows);
  return rows.map((row): RecentBill => {
    const bill = mapBill(row);
    const money = resolveBillListMoney(row, groupedItems.get(row.id) ?? [], groupedTransactions.get(row.id) ?? []);
    return {
      billDate: bill.billDate,
      billNo: bill.billNo,
      billType: bill.billType,
      customerAddress: bill.customerAddress,
      customerId: bill.customerId,
      customerMobile: bill.customerMobile,
      customerName: bill.customerName,
      entryStatus: bill.entryStatus,
      id: bill.id,
      netTotal: money.netTotal,
      subtotal: money.subtotal,
      syncStatus: bill.syncStatus,
    };
  });
}

export async function markBillEntered(db: LocalDatabase, billId: string) {
  await db.runAsync(
    "UPDATE bills SET entry_status = 'entered', entered_at = ?, sync_status = 'pending' WHERE id = ?",
    [nowIso(), billId],
  );
}

export async function getPartyFolders(db: LocalDatabase): Promise<PartyFolder[]> {
  const [customers, rows, itemRows, transactionRows] = await Promise.all([
    db.getAllAsync<CustomerRow>('SELECT * FROM customers ORDER BY name ASC'),
    db.getAllAsync<BillRow>('SELECT * FROM bills ORDER BY customer_name ASC, bill_date DESC'),
    db.getAllAsync<BillItemRow>('SELECT * FROM bill_items ORDER BY bill_id ASC, line_no ASC'),
    db.getAllAsync<BillTransactionRow>('SELECT * FROM bill_transactions ORDER BY transaction_date DESC, updated_at DESC'),
  ]);
  const groupedItems = groupItemsByBillId(itemRows);
  const groupedTransactions = groupTransactionsByBillId(transactionRows);
  const folders = new Map<string, PartyFolder>();

  for (const customerRow of customers) {
    const customer = mapCustomer(customerRow);
    folders.set(customer.id, {
      billCount: 0,
      customerAddress: customer.address,
      customerId: customer.id,
      customerMobile: customer.mobile,
      customerName: customer.name,
      lastBillDate: customer.updatedAt.slice(0, 10) || localIsoDate(),
      openingFineBalance: parseAmount(customer.openingFineBalance),
      openingLabourBalance: parseAmount(customer.openingLabourBalance),
      openingNote: customer.openingNote,
      totalAmount: parseAmount(customer.openingLabourBalance),
    });
  }

  for (const row of rows) {
    const bill = mapBill(row);
    const money = resolveBillListMoney(row, groupedItems.get(row.id) ?? [], groupedTransactions.get(row.id) ?? []);
    const existing = folders.get(bill.customerId);
    if (existing) {
      existing.billCount += 1;
      existing.totalAmount += money.netTotal;
      if (bill.billDate > existing.lastBillDate) {
        existing.lastBillDate = bill.billDate;
        existing.customerAddress = bill.customerAddress;
        existing.customerMobile = bill.customerMobile;
        existing.customerName = bill.customerName;
      }
    } else {
      folders.set(bill.customerId, {
        billCount: 1,
        customerAddress: bill.customerAddress,
        customerId: bill.customerId,
        customerMobile: bill.customerMobile,
        customerName: bill.customerName,
        lastBillDate: bill.billDate,
        openingFineBalance: 0,
        openingLabourBalance: 0,
        openingNote: '',
        totalAmount: money.netTotal,
      });
    }
  }

  return [...folders.values()].sort((a, b) => b.lastBillDate.localeCompare(a.lastBillDate));
}

export async function getPartyLedgerSummaries(db: LocalDatabase): Promise<PartyLedgerSummary[]> {
  const [customers, rows, itemRows, transactionRows, partyTransactionRows] = await Promise.all([
    db.getAllAsync<CustomerRow>('SELECT * FROM customers ORDER BY name ASC'),
    db.getAllAsync<BillRow>('SELECT * FROM bills ORDER BY customer_name ASC, bill_date DESC'),
    db.getAllAsync<BillItemRow>('SELECT * FROM bill_items ORDER BY bill_id ASC, line_no ASC'),
    db.getAllAsync<BillTransactionRow>('SELECT * FROM bill_transactions ORDER BY transaction_date DESC, updated_at DESC'),
    db.getAllAsync<PartyTransactionRow>('SELECT * FROM party_transactions ORDER BY transaction_date DESC, voucher_no DESC'),
  ]);
  const groupedItems = groupItemsByBillId(itemRows);
  const groupedTransactions = new Map<string, BillTransactionRow[]>();
  const ledgers = new Map<string, PartyLedgerSummary>();

  for (const transaction of transactionRows) {
    const current = groupedTransactions.get(transaction.bill_id) ?? [];
    current.push(transaction);
    groupedTransactions.set(transaction.bill_id, current);
  }

  for (const customerRow of customers) {
    const openingFine = Number(customerRow.opening_fine_balance ?? 0);
    const openingLabour = Number(customerRow.opening_labour_balance ?? 0);
    ledgers.set(customerRow.id, {
      amountReceived: 0,
      billCount: 0,
      customerId: customerRow.id,
      discountAmount: 0,
      fineAdvance: 0,
      fineBalance: 0,
      fineCleared: 0,
      fineGiven: openingFine,
      fineReceived: 0,
      labourBalance: openingLabour,
      labourTotal: openingLabour,
      lastBillDate: customerRow.updated_at.slice(0, 10) || localIsoDate(),
      openingFineBalance: openingFine,
      openingLabourBalance: openingLabour,
      partyDiscountAmount: 0,
      partyFineReceived: 0,
      partyPaymentAmount: 0,
      rateCutAmount: 0,
    });
  }

  for (const row of rows) {
    const items = groupedItems.get(row.id) ?? [];
    const transactions = groupedTransactions.get(row.id) ?? [];
    const money = resolveBillMoney(row, items);
    const existing =
      ledgers.get(row.customer_id) ??
      ({
        amountReceived: 0,
        billCount: 0,
        customerId: row.customer_id,
        discountAmount: 0,
        fineAdvance: 0,
        fineBalance: 0,
        fineCleared: 0,
        fineGiven: 0,
        fineReceived: 0,
        labourBalance: 0,
        labourTotal: 0,
        lastBillDate: row.bill_date,
        openingFineBalance: 0,
        openingLabourBalance: 0,
        partyDiscountAmount: 0,
        partyFineReceived: 0,
        partyPaymentAmount: 0,
        rateCutAmount: 0,
      } satisfies PartyLedgerSummary);

    const mappedItems = items.map(mapBillItem);
    const fineGiven = calculateTotalFine(mappedItems);
    const initialFineReceived =
      row.receipt_type === 'fine' || row.receipt_type === 'fine_cash' ? Number(row.received_fine ?? 0) : 0;
    const postFineReceived = transactions.reduce((sum, transaction) => sum + Number(transaction.fine_weight ?? 0), 0);
    const postCashBankReceived = transactions.reduce(
      (sum, transaction) => sum + Number(transaction.cash_amount ?? 0) + Number(transaction.bank_amount ?? 0),
      0,
    );
    const initialRateCutFine = Number(row.rate_cut_fine ?? 0);
    const initialRateCutAmount = Number(row.rate_cut_amount ?? 0);
    const postRateCutFine = transactions.reduce((sum, transaction) => sum + Number(transaction.rate_cut_fine ?? 0), 0);
    const postRateCutAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.rate_cut_amount ?? 0), 0);
    const fineCleared = initialFineReceived + postFineReceived + initialRateCutFine + postRateCutFine;
    const billLabourBalance = Math.max(money.netTotal - postCashBankReceived + postRateCutAmount, 0);
    const sanitizedDiscountAmount = sanitizeMirroredDiscountAmount(row, items);

    existing.billCount += 1;
    existing.fineGiven += fineGiven;
    existing.fineReceived += initialFineReceived + postFineReceived;
    existing.fineCleared += fineCleared;
    existing.labourTotal += money.subtotal;
    existing.amountReceived += money.receivedValue + postCashBankReceived;
    existing.rateCutAmount += initialRateCutAmount + postRateCutAmount;
    existing.discountAmount += sanitizedDiscountAmount;
    existing.labourBalance += billLabourBalance;
    if (row.bill_date > existing.lastBillDate) {
      existing.lastBillDate = row.bill_date;
    }
    ledgers.set(row.customer_id, existing);
  }

  for (const transaction of partyTransactionRows) {
    const existing =
      ledgers.get(transaction.customer_id) ??
      ({
        amountReceived: 0,
        billCount: 0,
        customerId: transaction.customer_id,
        discountAmount: 0,
        fineAdvance: 0,
        fineBalance: 0,
        fineCleared: 0,
        fineGiven: 0,
        fineReceived: 0,
        labourBalance: 0,
        labourTotal: 0,
        lastBillDate: transaction.transaction_date,
        openingFineBalance: 0,
        openingLabourBalance: 0,
        partyDiscountAmount: 0,
        partyFineReceived: 0,
        partyPaymentAmount: 0,
        rateCutAmount: 0,
      } satisfies PartyLedgerSummary);

    const cashBank = Number(transaction.cash_amount ?? 0) + Number(transaction.bank_amount ?? 0);
    const discount = Number(transaction.discount_amount ?? 0);
    const payment = Number(transaction.payment_amount ?? 0);
    const fine = Number(transaction.fine_weight ?? 0);
    const fineValue = transaction.mode === 'fine' ? Number(transaction.fine_value ?? 0) : 0;
    existing.amountReceived += cashBank;
    existing.discountAmount += discount;
    existing.partyDiscountAmount += discount;
    existing.partyPaymentAmount += payment;
    existing.partyFineReceived += fine;
    existing.fineReceived += fine;
    existing.fineCleared += fine;
    existing.labourBalance += payment - cashBank - discount + fineValue;
    if (transaction.transaction_date > existing.lastBillDate) {
      existing.lastBillDate = transaction.transaction_date;
    }
    ledgers.set(transaction.customer_id, existing);
  }

  return [...ledgers.values()]
    .map((ledger) => {
      const fineNet = Number((ledger.fineGiven - ledger.fineCleared).toFixed(6));
      return {
        ...ledger,
        fineAdvance: Math.max(-fineNet, 0),
        fineBalance: Math.max(fineNet, 0),
        labourBalance: Math.max(Number(ledger.labourBalance.toFixed(2)), 0),
      };
    })
    .sort((a, b) => b.lastBillDate.localeCompare(a.lastBillDate));
}

export async function getPartyLedgerSummaryAtDate(db: LocalDatabase, customerId: string, asOfIso: string): Promise<PartyLedgerSummary> {
  const customerRow = await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id = ?', [customerId]);
  const openingFine = Number(customerRow?.opening_fine_balance ?? 0);
  const openingLabour = Number(customerRow?.opening_labour_balance ?? 0);

  const ledger: PartyLedgerSummary = {
    customerId,
    billCount: 0,
    fineGiven: openingFine,
    fineReceived: 0,
    fineCleared: 0,
    fineBalance: 0,
    fineAdvance: 0,
    openingFineBalance: openingFine,
    openingLabourBalance: openingLabour,
    labourTotal: openingLabour,
    amountReceived: 0,
    partyPaymentAmount: 0,
    partyDiscountAmount: 0,
    partyFineReceived: 0,
    rateCutAmount: 0,
    discountAmount: 0,
    labourBalance: openingLabour,
    lastBillDate: customerRow?.updated_at?.slice(0, 10) || localIsoDate(),
  };

  const [billRows, itemRows, billTransactionRows, partyTransactionRows] = await Promise.all([
    db.getAllAsync<BillRow>('SELECT * FROM bills WHERE customer_id = ? AND updated_at <= ? ORDER BY bill_date ASC', [customerId, asOfIso]),
    db.getAllAsync<BillItemRow>('SELECT bi.* FROM bill_items bi JOIN bills b ON bi.bill_id = b.id WHERE b.customer_id = ? AND b.updated_at <= ? ORDER BY bi.bill_id ASC, bi.line_no ASC', [customerId, asOfIso]),
    db.getAllAsync<BillTransactionRow>('SELECT bt.* FROM bill_transactions bt JOIN bills b ON bt.bill_id = b.id WHERE b.customer_id = ? AND bt.updated_at <= ? ORDER BY bt.transaction_date DESC, bt.updated_at DESC', [customerId, asOfIso]),
    db.getAllAsync<PartyTransactionRow>('SELECT * FROM party_transactions WHERE customer_id = ? AND updated_at <= ? ORDER BY transaction_date ASC, voucher_no ASC', [customerId, asOfIso]),
  ]);

  const groupedItems = groupItemsByBillId(itemRows);
  const groupedBillTransactions = groupTransactionsByBillId(billTransactionRows);

  for (const row of billRows) {
    const items = groupedItems.get(row.id) ?? [];
    const transactions = groupedBillTransactions.get(row.id) ?? [];
    const money = resolveBillMoney(row, items);
    const mappedItems = items.map(mapBillItem);
    const fineGiven = calculateTotalFine(mappedItems);
    const initialFineReceived = row.receipt_type === 'fine' || row.receipt_type === 'fine_cash' ? Number(row.received_fine ?? 0) : 0;
    const postFineReceived = transactions.reduce((sum, transaction) => sum + Number(transaction.fine_weight ?? 0), 0);
    const postCashBankReceived = transactions.reduce((sum, transaction) => sum + Number(transaction.cash_amount ?? 0) + Number(transaction.bank_amount ?? 0), 0);
    const initialRateCutFine = Number(row.rate_cut_fine ?? 0);
    const initialRateCutAmount = Number(row.rate_cut_amount ?? 0);
    const postRateCutFine = transactions.reduce((sum, transaction) => sum + Number(transaction.rate_cut_fine ?? 0), 0);
    const postRateCutAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.rate_cut_amount ?? 0), 0);
    const fineCleared = initialFineReceived + postFineReceived + initialRateCutFine + postRateCutFine;
    const billLabourBalance = Math.max(money.netTotal - postCashBankReceived + postRateCutAmount, 0);
    const sanitizedDiscountAmount = sanitizeMirroredDiscountAmount(row, items);

    ledger.billCount += 1;
    ledger.fineGiven += fineGiven;
    ledger.fineReceived += initialFineReceived + postFineReceived;
    ledger.fineCleared += fineCleared;
    ledger.labourTotal += money.subtotal;
    ledger.amountReceived += money.receivedValue + postCashBankReceived;
    ledger.rateCutAmount += initialRateCutAmount + postRateCutAmount;
    ledger.discountAmount += sanitizedDiscountAmount;
    ledger.labourBalance += billLabourBalance;
    if (row.bill_date > ledger.lastBillDate) {
      ledger.lastBillDate = row.bill_date;
    }
  }

  for (const transaction of partyTransactionRows) {
    const cashBank = Number(transaction.cash_amount ?? 0) + Number(transaction.bank_amount ?? 0);
    const discount = Number(transaction.discount_amount ?? 0);
    const payment = Number(transaction.payment_amount ?? 0);
    const fine = Number(transaction.fine_weight ?? 0);
    const fineValue = transaction.mode === 'fine' ? Number(transaction.fine_value ?? 0) : 0;
    ledger.amountReceived += cashBank;
    ledger.discountAmount += discount;
    ledger.partyDiscountAmount += discount;
    ledger.partyPaymentAmount += payment;
    ledger.partyFineReceived += fine;
    ledger.fineReceived += fine;
    ledger.fineCleared += fine;
    ledger.labourBalance += payment - cashBank - discount + fineValue;
    if (transaction.transaction_date > ledger.lastBillDate) {
      ledger.lastBillDate = transaction.transaction_date;
    }
  }

  const fineNet = Number((ledger.fineGiven - ledger.fineCleared).toFixed(6));
  return {
    ...ledger,
    fineAdvance: Math.max(-fineNet, 0),
    fineBalance: Math.max(fineNet, 0),
    labourBalance: Math.max(Number(ledger.labourBalance.toFixed(2)), 0),
  };
}
export async function getBillPayload(db: LocalDatabase, billId: string) {
  const billRow = await db.getFirstAsync<BillRow>('SELECT * FROM bills WHERE id = ?', [billId]);
  if (!billRow) {
    return null;
  }

  const bill = mapBill(billRow);
  const itemRows = await db.getAllAsync<BillItemRow>(
    'SELECT * FROM bill_items WHERE bill_id = ? ORDER BY line_no ASC',
    [billId],
  );
  const customerRow = await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id = ?', [bill.customerId]);
  const money = resolveBillMoney(billRow, itemRows);
  const discountAmount = sanitizeMirroredDiscountAmount(billRow, itemRows);

  return {
    billDate: bill.billDate,
    billNo: bill.billNo,
    billType: bill.billType,
    autoRoundFigure: money.autoRoundFigure,
    customer: {
      address: bill.customerAddress,
      id: bill.customerId,
      mobile: bill.customerMobile,
      name: bill.customerName,
      openingFineBalance: String(billRow.display_opening_fine_balance ?? customerRow?.opening_fine_balance ?? ''),
      openingLabourBalance: String(billRow.display_opening_labour_balance ?? customerRow?.opening_labour_balance ?? ''),
      openingNote: billRow.display_opening_note ?? customerRow?.opening_note ?? '',
    },
    finalAmountOverride: money.finalAmountOverride,
    items: itemRows.map(mapBillItem),
    language: bill.language,
    receiptType: bill.receiptType,
    receiptMaterial: bill.receiptMaterial,
    receivedGrossWeight: String(bill.receivedGrossWeight || ''),
    receivedTouch: String(bill.receivedTouch || ''),
    receivedFine: String(bill.receivedFine || ''),
    receivedCash: String(bill.receivedCash || ''),
    receivedPriceOverride: String(bill.receivedPriceOverride || ''),
    receivedValue: money.receivedValue,
    rateCutFine: String(bill.rateCutFine || ''),
    rateCutAmount: String(bill.rateCutAmount || ''),
    rateCutAdjustsLabour: bill.rateCutAdjustsLabour,
    rateCutBookedRate: bill.rateCutBookedRate,
    discountAmount: discountAmount > 0 ? String(discountAmount) : '',
    netTotal: money.netTotal,
    subtotal: money.subtotal,
    note: '',
  };
}

export async function getPendingRows(db: LocalDatabase) {
  const [
    rates,
    customers,
    itemNames,
    billReminders,
    marketRuns,
    bills,
    billItems,
    billTransactions,
    partyTransactions,
    supplierAccounts,
    supplierTransactions,
    cashBankEntries,
  ] = await Promise.all([
    db.getAllAsync<RateRow>("SELECT * FROM rates WHERE sync_status != 'synced'"),
    db.getAllAsync<CustomerRow>("SELECT * FROM customers WHERE sync_status != 'synced'"),
    db.getAllAsync<ItemNameRow>("SELECT * FROM item_names WHERE sync_status != 'synced'"),
    db.getAllAsync<BillReminderRow>("SELECT * FROM bill_reminders WHERE sync_status != 'synced'"),
    db.getAllAsync<MarketRunRow>("SELECT * FROM market_runs WHERE sync_status != 'synced'"),
    db.getAllAsync<BillRow>("SELECT * FROM bills WHERE sync_status != 'synced'"),
    db.getAllAsync<BillItemRow>("SELECT * FROM bill_items WHERE sync_status != 'synced'"),
    db.getAllAsync<BillTransactionRow>("SELECT * FROM bill_transactions WHERE sync_status != 'synced'"),
    db.getAllAsync<PartyTransactionRow>("SELECT * FROM party_transactions WHERE sync_status != 'synced'"),
    db.getAllAsync<SupplierAccountRow>("SELECT * FROM supplier_accounts WHERE sync_status != 'synced'"),
    db.getAllAsync<SupplierTransactionRow>("SELECT * FROM supplier_transactions WHERE sync_status != 'synced'"),
    db.getAllAsync<CashBankEntryRow>("SELECT * FROM cash_bank_entries WHERE sync_status != 'synced'"),
  ]);

  return {
    billItems: billItems.map(mapBillItem),
    billReminders: billReminders.map(mapBillReminder),
    billTransactions: billTransactions.map(mapBillTransaction),
    bills: bills.map(mapBill),
    customers: customers.map(mapCustomer),
    itemNames: itemNames.map(mapItemName),
    marketRuns: marketRuns.map(mapMarketRun),
    partyTransactions: partyTransactions.map(mapPartyTransaction),
    rates: rates.map(mapRate),
    supplierAccounts: supplierAccounts.map(mapSupplierAccount),
    supplierTransactions: supplierTransactions.map(mapSupplierTransaction),
    cashBankEntries: cashBankEntries.map(mapCashBankEntry),
  };
}

export async function markTableRowsSynced(db: LocalDatabase, table: string, ids: string[]) {
  if (!ids.length) {
    return;
  }

  for (const id of ids) {
    await db.runAsync(`UPDATE ${table} SET sync_status = 'synced' WHERE id = ?`, [id]);
  }
}

export async function repairMirroredDiscountRows(db: LocalDatabase) {
  const rows = await db.getAllAsync<BillRow>('SELECT * FROM bills');
  const itemRows = await db.getAllAsync<BillItemRow>('SELECT * FROM bill_items ORDER BY bill_id ASC, line_no ASC');
  const groupedItems = groupItemsByBillId(itemRows);
  let repaired = 0;

  for (const row of rows) {
    const items = groupedItems.get(row.id) ?? [];
    const currentDiscountAmount = Number(row.discount_amount ?? 0);
    const currentNetTotal = Number(row.net_total ?? 0);
    const sanitizedDiscountAmount = sanitizeMirroredDiscountAmount(row, items);
    const { exactNet } = exactBillNetTotal(row, items);
    const shouldRepairDiscount = currentDiscountAmount > 0 && Math.abs(currentDiscountAmount - sanitizedDiscountAmount) > 0.01;
    const shouldRepairZeroNet = currentNetTotal <= 0 && exactNet > 0;

    if (shouldRepairDiscount || shouldRepairZeroNet) {
      await db.runAsync("UPDATE bills SET discount_amount = ?, net_total = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?", [
        sanitizedDiscountAmount,
        exactNet,
        nowIso(),
        row.id,
      ]);
      repaired += 1;
    }
  }

  return repaired;
}

export async function deletePartyWithBills(db: LocalDatabase, customerId: string) {
  await db.runAsync('DELETE FROM bill_items WHERE bill_id IN (SELECT id FROM bills WHERE customer_id = ?)', [customerId]);
  await db.runAsync('DELETE FROM bill_transactions WHERE bill_id IN (SELECT id FROM bills WHERE customer_id = ?)', [customerId]);
  await db.runAsync('DELETE FROM bill_reminders WHERE bill_id IN (SELECT id FROM bills WHERE customer_id = ?)', [customerId]);
  await db.runAsync('DELETE FROM party_transactions WHERE customer_id = ?', [customerId]);
  await db.runAsync('DELETE FROM bills WHERE customer_id = ?', [customerId]);
  await db.runAsync('DELETE FROM customers WHERE id = ?', [customerId]);
}

export async function getPartiesWithJangadBills(db: LocalDatabase): Promise<PartyFolder[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT c.id AS customer_id, c.name AS customer_name, c.mobile AS customer_mobile, c.address AS customer_address,
            COUNT(b.id) AS bill_count, MAX(b.bill_date) AS last_bill_date,
            COALESCE(SUM(b.net_total), 0) AS total_amount
     FROM customers c INNER JOIN bills b ON b.customer_id = c.id
     WHERE b.bill_type = 'jangad'
     GROUP BY c.id ORDER BY c.name ASC`,
  );
  return rows.map(mapPartyFolderRow);
}

export async function getJangadBillsForParty(db: LocalDatabase, customerId: string): Promise<RecentBill[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM bills WHERE customer_id = ? AND bill_type = 'jangad' ORDER BY bill_date DESC, bill_no DESC`,
    [customerId],
  );
  return rows.map(mapRecentBillRow);
}

export async function getReturnsForBill(db: LocalDatabase, billId: string): Promise<(JangadReturnVoucher & { items: JangadReturnItem[] })[]> {
  const vouchers = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM jangad_return_vouchers WHERE bill_id = ? ORDER BY return_date DESC`,
    [billId],
  );
  const result: (JangadReturnVoucher & { items: JangadReturnItem[] })[] = [];
  for (const v of vouchers) {
    const items = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM jangad_return_items WHERE voucher_id = ? ORDER BY item_name ASC`,
      [v.id as string],
    );
    result.push({ ...mapJangadReturnVoucher(v), items: items.map(mapJangadReturnItem) });
  }
  return result;
}

export async function saveJangadReturn(
  db: LocalDatabase,
  voucher: { billId: string; customerId: string; returnDate: string; note: string; items: { itemName: string; weight: number; pcs: number }[] },
) {
  const voucherId = createId('ret');
  const now = localIsoDate();
  await db.runAsync(
    'INSERT INTO jangad_return_vouchers (id, bill_id, customer_id, return_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [voucherId, voucher.billId, voucher.customerId, voucher.returnDate, voucher.note, now],
  );
  for (const item of voucher.items) {
    const itemId = createId('rti');
    await db.runAsync(
      'INSERT INTO jangad_return_items (id, voucher_id, item_name, weight, pcs) VALUES (?, ?, ?, ?, ?)',
      [itemId, voucherId, item.itemName, item.weight, item.pcs],
    );
  }
  return voucherId;
}

export async function deleteJangadReturn(db: LocalDatabase, voucherId: string) {
  await db.runAsync('DELETE FROM jangad_return_items WHERE voucher_id = ?', [voucherId]);
  await db.runAsync('DELETE FROM jangad_return_vouchers WHERE id = ?', [voucherId]);
}

import * as SQLite from 'expo-sqlite';
export async function initDatabase(): Promise<LocalDatabase> {
  const db = await SQLite.openDatabaseAsync('billbook.db');
  await migrateDbIfNeeded(db);
  return db as unknown as LocalDatabase;
}
