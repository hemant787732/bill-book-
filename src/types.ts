export type MetalType = 'silver';
export type Language = 'en' | 'hi' | 'gu';
export type BillType = 'estimate' | 'jangad';
export type LabourType = 'gw' | 'pcs';
export type ReceiptType = 'none' | 'fine' | 'cash' | 'fine_cash';
export type LedgerMode = 'cash' | 'bank' | 'split' | 'fine' | 'payment' | 'discount' | 'fine_rec';
export type SyncStatus = 'pending' | 'synced';
export type ReminderStatus = 'active' | 'done';
export type OfficeEntryStatus = 'pending' | 'entered';

export interface BillItemDraft {
  id: string;
  itemName: string;
  material: MetalType;
  weight: string;
  touch: string;
  pcs: string;
  rate: string;
  labour: string;
  labourType: LabourType;
  packetLess: string;
  fine: string;
  amount: string;
  // Supplier the metal for this line came from (per-item). Drives auto-posting
  // of a supplier payable when the bill is saved.
  supplierId?: string;
  supplierName?: string;
}

export interface BillItemRecord extends BillItemDraft {
  billId: string;
  lineNo: number;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface CustomerDraft {
  id?: string;
  name: string;
  mobile: string;
  address: string;
  openingFineBalance?: string;
  openingLabourBalance?: string;
  openingNote?: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  mobile: string;
  address: string;
  openingFineBalance: number;
  openingLabourBalance: number;
  openingNote: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface BillPayload {
  billNo: number;
  billDate: string;
  billType: BillType;
  language: Language;
  customer: CustomerDraft;
  items: BillItemDraft[];
  subtotal: number;
  autoRoundFigure: boolean;
  finalAmountOverride: string;
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
  supplierId?: string;
  supplierName?: string;
  note?: string;
}

export interface BillRecord {
  id: string;
  billNo: number;
  billDate: string;
  billType: BillType;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  displayOpeningFineBalance: number;
  displayOpeningLabourBalance: number;
  displayOpeningNote: string;
  language: Language;
  subtotal: number;
  receiptType: ReceiptType;
  receiptMaterial: MetalType;
  receivedGrossWeight: number;
  receivedTouch: number;
  receivedFine: number;
  receivedCash: number;
  receivedPriceOverride: number;
  receivedValue: number;
  rateCutFine: number;
  rateCutAmount: number;
  rateCutAdjustsLabour: boolean;
  rateCutBookedRate: number;
  discountAmount: number;
  netTotal: number;
  payload: string;
  entryStatus: OfficeEntryStatus;
  enteredAt: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface BillReminder {
  id: string;
  billId: string;
  billNo: number;
  customerName: string;
  customerMobile: string;
  dueAt: string;
  status: ReminderStatus;
  extendedCount: number;
  notificationId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface MarketRun {
  id: string;
  runDate: string;
  goldWeight: number;
  silverWeight: number;
  note: string;
  // Physically counted remaining stock at day-end (gm) + whether the day is
  // reconciled/closed.
  actualSilverRemaining: number;
  actualGoldRemaining: number;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface MarketStockSummary extends MarketRun {
  billCount: number;
  goldSold: number;
  silverSold: number;
  // Expected remaining = taken − sold.
  goldRemaining: number;
  silverRemaining: number;
  // Variance = expected − actual (positive = short / missing, negative = extra).
  goldVariance: number;
  silverVariance: number;
}

export interface Rate {
  id: string;
  rateDate: string;
  gold10gRate: number;
  silver1kgRate: number;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface ItemNameOption {
  id: string;
  name: string;
  material: MetalType;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface PartyFolder {
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  billCount: number;
  lastBillDate: string;
  openingNote: string;
  totalAmount: number;
  openingFineBalance: number;
  openingLabourBalance: number;
}

export interface PartyLedgerSummary {
  customerId: string;
  billCount: number;
  fineGiven: number;
  fineReceived: number;
  fineCleared: number;
  fineBalance: number;
  fineAdvance: number;
  openingFineBalance: number;
  openingLabourBalance: number;
  labourTotal: number;
  amountReceived: number;
  partyPaymentAmount: number;
  partyDiscountAmount: number;
  partyFineReceived: number;
  rateCutAmount: number;
  discountAmount: number;
  labourBalance: number;
  lastBillDate: string;
}

export type PartyTransactionMode = LedgerMode;

export interface PartyTransaction {
  id: string;
  customerId: string;
  voucherNo: number;
  transactionDate: string;
  mode: PartyTransactionMode;
  material: MetalType;
  cashAmount: number;
  bankAmount: number;
  fineWeight: number;
  bookedRate: number;
  fineValue: number;
  paymentAmount: number;
  discountAmount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

// Links a party transaction to the specific bill(s) it settles, with the fine
// and amount allocated to each. Drives per-bill outstanding ("balance version").
export interface TransactionAllocation {
  id: string;
  transactionId: string;
  customerId: string;
  billId: string;
  billNo: number;
  fineAlloc: number;
  amountAlloc: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

// Per-bill running balance for a party: original dues vs what's been settled
// (bill transactions + party-transaction allocations) = outstanding.
export interface BillBalance {
  billId: string;
  billNo: number;
  billDate: string;
  fineDue: number;
  amountDue: number;
  finePaid: number;
  amountPaid: number;
  fineOutstanding: number;
  amountOutstanding: number;
}

// A device that has signed in. `revoked` flips when removed from another device;
// the revoked device signs itself out on its next app-open / realtime tick.
export interface Device {
  id: string;
  deviceId: string;
  userEmail: string;
  deviceName: string;
  platform: string;
  lastSeen: string;
  revoked: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface SupplierAccount {
  id: string;
  entryDate: string;
  name: string;
  mobile: string;
  address: string;
  openingFinePayable: number;
  openingAmountPayable: number;
  openingNote: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface SupplierLedgerSummary {
  supplierId: string;
  amountPaid: number;
  amountPayable: number;
  discountAmount: number;
  finePayable: number;
  lastTransactionDate: string;
  metalPaid: number;
  openingAmountPayable: number;
  openingFinePayable: number;
  purchaseAmount: number;
  purchaseFine: number;
  metalConsumed?: number;
  inventoryOnHand?: number;
  transactionCount: number;
}

// A single line on a supplier purchase voucher (items bought from the supplier).
export interface SupplierPurchaseItem {
  id: string;
  transactionId: string;
  supplierId: string;
  lineNo: number;
  itemName: string;
  pcs: string;
  weight: string;
  touch: string;
  fine: string;
  rate: string;
  amount: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

// One row of the purchased-items stock ledger: stock bought from a supplier for
// an item, minus stock sold (bill items linked to that supplier), = on hand.
export interface PurchaseStockRow {
  supplierId: string;
  supplierName: string;
  itemName: string;
  pcsIn: number;
  pcsSold: number;
  pcsOnHand: number;
  fineIn: number;
  fineSold: number;
  fineOnHand: number;
  weightIn: number;
  weightSold: number;
  weightOnHand: number;
}

export interface StockItemLedgerEntry {
  id: string;
  date: string;
  refNo: number;
  accountName: string;
  pcs: number;
  weight: number;
  packetLess?: number;
  netWeight: number;
  touch: number;
  fine: number;
  sourceTouch?: number;
  sourceFine?: number;
  rate: number;
  amount: number;
}

export interface StockItemLedger {
  supplierId: string;
  supplierName: string;
  itemName: string;
  purchases: StockItemLedgerEntry[];
  sales: StockItemLedgerEntry[];
  purchasePcs: number;
  salePcs: number;
  pcsBalance: number;
  purchaseFine: number;
  saleFine: number;
  stockFineLess: number;
  fineBalance: number;
}

export type SupplierTransactionMode = 'cash_payment' | 'bank_payment' | 'split_payment' | 'metal_paid' | 'purchase' | 'discount';

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  voucherNo: number;
  transactionDate: string;
  mode: SupplierTransactionMode;
  material: MetalType;
  fineWeight: number;
  bookedRate: number;
  fineValue: number;
  cashAmount: number;
  bankAmount: number;
  discountAmount: number;
  note: string;
  // 'manual' for hand-entered transactions. Older installs may still contain
  // legacy 'bill' rows, but sale bills now reduce stock through bill_items.
  sourceType?: string;
  sourceBillId?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

// One concluded bill in the comparison ledger: supplier stock reduced vs. what
// we credited to the party, and the margin / labour we earned on it.
export interface FlowLedgerRow {
  billId: string;
  billNo: number;
  date: string;
  partyName: string;
  supplierNames: string;
  fineLinked: number;   // supplier stock reduced by linked bill items
  fineSold: number;     // fine credited / billed to the party
  fineMargin: number;   // fineSold - fineLinked
  labourEarned: number; // labour charged on the bill (our earning)
  amount: number;       // bill net total
}

export interface FlowLedgerSummary {
  totalFineLinked: number;
  totalFineSold: number;
  totalFineMargin: number;
  totalLabourEarned: number;
  totalAmount: number;
  billCount: number;
  rows: FlowLedgerRow[];
}

export interface CashBankEntry {
  id: string;
  date: string;
  entryDate: string;
  mode: string;
  particular: string;
  party: string;
  receiptAmount: number;
  paymentAmount: number;
  receipt: number;
  payment: number;
  balance: number;
  type: 'cash' | 'bank';
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface RecentBill {
  id: string;
  billNo: number;
  billDate: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  customerId: string;
  subtotal: number;
  netTotal: number;
  billType: BillType;
  entryStatus: OfficeEntryStatus;
  syncStatus: SyncStatus;
}

export interface BillTransaction {
  id: string;
  billId: string;
  transactionDate: string;
  mode: 'cash' | 'bank' | 'fine' | 'discount' | 'split' | 'rate_cut';
  cashAmount: number;
  bankAmount: number;
  fineWeight: number;
  rateCutFine: number;
  rateCutAmount: number;
  bookedRate: number;
  note: string;
  material: MetalType;
  amount: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export type BillTransactionMode = 'cash' | 'bank' | 'fine' | 'discount' | 'split' | 'rate_cut';

export interface JangadReturnVoucher {
  id: string;
  billId: string;
  customerId: string;
  returnDate: string;
  note: string;
  createdAt: string;
}

export interface JangadReturnItem {
  id: string;
  voucherId: string;
  itemName: string;
  weight: number;
  pcs: number;
}
