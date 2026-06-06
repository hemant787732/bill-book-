import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MetalType, SupplierAccount, SupplierLedgerSummary, SupplierTransaction, SupplierTransactionMode } from '../types';
import { formatCalcValue } from '../utils/calculations';
import { formatDateForBill, formatMoney, localIsoDate, parseAmount } from '../utils/format';
import type { SupplierManualDraft } from './supplier-sql';
import Card from '../components/Card';
import FAB from '../components/FAB';
import { HeaderBar } from '../ui';

export type SupplierDraft = Omit<SupplierManualDraft, 'id'>;

export type SupplierTransactionFormInput = {
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

type SupplierListProps = {
  ledgers: Map<string, SupplierLedgerSummary>;
  onAddSupplier: () => void;
  onBack: () => void;
  onOpenSupplier: (supplierId: string) => void;
  suppliers: SupplierAccount[];
};

type SupplierDetailProps = {
  ledger: SupplierLedgerSummary | null;
  onBack: () => void;
  onOpenTransact: () => void;
  supplier: SupplierAccount;
  transactions: SupplierTransaction[];
};

type SupplierTransactProps = {
  ledger: SupplierLedgerSummary | null;
  onBack: () => void;
  onSaveSupplierTransaction: (input: SupplierTransactionFormInput) => Promise<SupplierTransaction | false>;
  supplier: SupplierAccount;
  transactions: SupplierTransaction[];
};

function formatDateInput(value: string) {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function includesSearch(values: (string | number | null | undefined)[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return values.some((value) => String(value ?? '').toLowerCase().includes(needle));
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
    case 'purchase':
    default:
      return 'Purchase';
  }
}

function metalRateLabel(material: MetalType) {
  return material === 'gold' ? 'Gold / 10 gm' : 'Silver / 1 kg';
}

function fineValueFromBookedRate(material: MetalType, fineWeight: string | number, bookedRate: string | number) {
  const fine = parseAmount(fineWeight);
  const rate = parseAmount(bookedRate);
  if (fine <= 0 || rate <= 0) {
    return 0;
  }
  return material === 'gold' ? (fine * rate) / 10 : (fine * rate) / 1000;
}

function SupplierHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return <HeaderBar title={title} onBack={onBack} />;
}

function SupplierField({
  editable = true,
  keyboardType,
  label,
  multiline,
  onChangeText,
  selectTextOnFocus,
  value,
}: {
  editable?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'phone-pad';
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  selectTextOnFocus?: boolean;
  value: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor="#9a827d"
        selectTextOnFocus={selectTextOnFocus}
        style={[styles.input, multiline && styles.multilineInput, !editable && styles.disabledInput]}
        value={value}
      />
    </View>
  );
}

function DateField({ label, onChangeText, value }: { label: string; onChangeText: (value: string) => void; value: string }) {
  return <SupplierField keyboardType="number-pad" label={label} value={formatDateInput(value)} onChangeText={(next) => onChangeText(formatDateInput(next))} />;
}

function SearchBox({ onChangeText, placeholder, value }: { onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return (
    <View style={styles.searchWrap}>
      <Text style={styles.fieldLabel}>Search</Text>
      <TextInput onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9a827d" style={styles.searchInput} value={value} />
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

function Segment<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.segmentButton, value === option.value && styles.segmentButtonActive]}>
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
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

export function SupplierListScreen({ ledgers, onAddSupplier, onBack, onOpenSupplier, suppliers }: SupplierListProps) {
  const [search, setSearch] = useState('');
  const filteredSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplierMatchesSearch(supplier, ledgers.get(supplier.id), search)),
    [ledgers, search, suppliers],
  );
  const totalFinePayable = suppliers.reduce((sum, supplier) => sum + (ledgers.get(supplier.id)?.finePayable ?? supplier.openingFinePayable), 0);
  const totalAmountPayable = suppliers.reduce((sum, supplier) => sum + (ledgers.get(supplier.id)?.amountPayable ?? supplier.openingAmountPayable), 0);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <SupplierHeader title="Suppliers" onBack={onBack} />
      <View style={styles.summaryStrip}>
        <SummaryTile label="Fine payable" value={`${formatCalcValue(totalFinePayable, 3) || '0'} gm`} />
        <SummaryTile label="Amount payable" value={formatMoney(totalAmountPayable)} />
      </View>
      <Pressable onPress={onAddSupplier} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Add supplier</Text>
      </Pressable>
      <SearchBox placeholder="Search supplier, mobile, address" value={search} onChangeText={setSearch} />
      <View style={styles.list}>
        {filteredSuppliers.length ? (
          filteredSuppliers.map((supplier) => {
            const ledger = ledgers.get(supplier.id);
            return (
              <Pressable key={supplier.id} onPress={() => onOpenSupplier(supplier.id)} style={{ marginBottom: 12 }}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                  <View style={styles.iconBox}>
                    <Text style={styles.iconText}>S</Text>
                  </View>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardTitle}>{supplier.name}</Text>
                    <Text style={styles.cardMeta}>Entry {formatDateForBill(supplier.entryDate)}</Text>
                    <Text style={styles.cardMeta}>{supplier.mobile || 'No mobile'}</Text>
                    <Text style={styles.cardMeta}>{supplier.address || 'No address'}</Text>
                  </View>
                  <View style={styles.cardAmountBlock}>
                    <Text style={styles.cardAmount}>{formatMoney(ledger?.amountPayable ?? supplier.openingAmountPayable)}</Text>
                    <Text style={styles.cardFine}>{formatCalcValue(ledger?.finePayable ?? supplier.openingFinePayable, 3) || '0'} gm</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.emptyText}>{suppliers.length ? 'Search me supplier nahi mila.' : 'Abhi supplier account nahi hai.'}</Text>
        )}
      </View>
      <FAB onPress={onAddSupplier} />
    </ScrollView>
  );
}

export function AddSupplierScreen({ onBack, onSaveSupplier }: { onBack: () => void; onSaveSupplier: (draft: SupplierDraft) => Promise<SupplierAccount | false> }) {
  const [entryDate, setEntryDate] = useState(formatDateForBill(localIsoDate()));
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [openingFinePayable, setOpeningFinePayable] = useState('');
  const [openingAmountPayable, setOpeningAmountPayable] = useState('');
  const [openingNote, setOpeningNote] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  async function submitSupplier() {
    setIsSavingSupplier(true);
    try {
      const saved = await onSaveSupplier({
        address,
        entryDate,
        mobile,
        name,
        openingAmountPayable,
        openingFinePayable,
        openingNote,
      });
      if (saved) {
        onBack();
      }
    } finally {
      setIsSavingSupplier(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <SupplierHeader title="Add supplier" onBack={onBack} />
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Supplier manual entry</Text>
        <Text style={styles.heroText}>Date ke saath supplier, opening fine payable aur amount payable save hoga.</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Supplier details</Text>
        <View style={styles.formGrid}>
          <DateField label="Entry date" value={entryDate} onChangeText={setEntryDate} />
          <SupplierField label="Supplier name" value={name} onChangeText={setName} />
          <SupplierField keyboardType="phone-pad" label="Mobile" value={mobile} onChangeText={setMobile} />
          <SupplierField label="Address" multiline value={address} onChangeText={setAddress} />
          <SupplierField keyboardType="decimal-pad" label="Opening fine payable (gm)" selectTextOnFocus value={openingFinePayable} onChangeText={setOpeningFinePayable} />
          <SupplierField keyboardType="decimal-pad" label="Opening amount payable" selectTextOnFocus value={openingAmountPayable} onChangeText={setOpeningAmountPayable} />
          <SupplierField label="Opening note" multiline value={openingNote} onChangeText={setOpeningNote} />
        </View>
        <View style={styles.summaryStrip}>
          <SummaryTile label="Fine payable" value={`${formatCalcValue(parseAmount(openingFinePayable), 3) || '0'} gm`} />
          <SummaryTile label="Amount payable" value={formatMoney(parseAmount(openingAmountPayable))} />
        </View>
        <Pressable disabled={isSavingSupplier} onPress={submitSupplier} style={[styles.primaryButton, isSavingSupplier && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{isSavingSupplier ? 'Saving supplier...' : 'Save supplier'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export function SupplierDetailScreen({ ledger, onBack, onOpenTransact, supplier, transactions }: SupplierDetailProps) {
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
      <SupplierHeader title="Supplier ledger" onBack={onBack} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>S</Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{supplier.name}</Text>
          <Text style={styles.cardMeta}>Entry {formatDateForBill(supplier.entryDate)}</Text>
          <Text style={styles.cardMeta}>{supplier.mobile || 'No mobile'}</Text>
          <Text style={styles.cardMeta}>{supplier.address || 'No address'}</Text>
        </View>
      </Card>
      <View style={styles.summaryStrip}>
        <SummaryTile label="Fine payable" value={`${formatCalcValue(ledger?.finePayable ?? supplier.openingFinePayable, 3) || '0'} gm`} />
        <SummaryTile label="Amount payable" value={formatMoney(ledger?.amountPayable ?? supplier.openingAmountPayable)} />
        <SummaryTile label="Paid" value={formatMoney(ledger?.amountPaid ?? 0)} />
      </View>
      <Pressable onPress={onOpenTransact} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Transact / pay supplier</Text>
      </Pressable>
      <SearchBox placeholder="Search voucher, date, amount" value={search} onChangeText={setSearch} />
      <View style={styles.list}>
        {filteredTransactions.length ? (
          filteredTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionRow}>
              <View style={styles.cardMain}>
                <Text style={styles.transactionTitle}>Voucher #{transaction.voucherNo} - {formatDateForBill(transaction.transactionDate)}</Text>
                <Text style={styles.cardMeta}>{supplierTransactionModeLabel(transaction.mode)}</Text>
                <Text style={styles.cardMeta}>
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

export function SupplierTransactScreen({ ledger, onBack, onSaveSupplierTransaction, supplier, transactions }: SupplierTransactProps) {
  const [transactionDate, setTransactionDate] = useState(formatDateForBill(localIsoDate()));
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
      <SupplierHeader title={`${supplier.name} transact`} onBack={onBack} />
      <View style={styles.summaryStrip}>
        <SummaryTile label="Fine payable" value={`${formatCalcValue(ledger?.finePayable ?? supplier.openingFinePayable, 3) || '0'} gm`} />
        <SummaryTile label="Amount payable" value={formatMoney(ledger?.amountPayable ?? supplier.openingAmountPayable)} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>New supplier entry</Text>
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
          onChange={setMode}
        />
        <View style={styles.formGrid}>
          <DateField label="Date" value={transactionDate} onChangeText={setTransactionDate} />
          {mode === 'purchase' || mode === 'metal_paid' ? (
            <>
              <Text style={styles.fieldLabel}>Metal</Text>
              <MetalSelector material={material} onChange={setMaterial} />
              <SupplierField keyboardType="decimal-pad" label={mode === 'purchase' ? 'Purchase fine (gm)' : 'Metal paid (gm)'} selectTextOnFocus value={fineWeight} onChangeText={setFineWeight} />
            </>
          ) : null}
          {mode === 'purchase' ? (
            <>
              <SupplierField keyboardType="decimal-pad" label={`Booked rate (${metalRateLabel(material)})`} selectTextOnFocus value={bookedRate} onChangeText={setBookedRate} />
              <SupplierField editable={false} label="Purchase amount equivalent" value={metalValue > 0 ? formatMoney(metalValue) : ''} onChangeText={() => {}} />
            </>
          ) : null}
          {mode === 'cash_payment' || mode === 'split_payment' ? (
            <SupplierField keyboardType="decimal-pad" label="Cash paid" selectTextOnFocus value={cashAmount} onChangeText={setCashAmount} />
          ) : null}
          {mode === 'bank_payment' || mode === 'split_payment' ? (
            <SupplierField keyboardType="decimal-pad" label="Bank paid" selectTextOnFocus value={bankAmount} onChangeText={setBankAmount} />
          ) : null}
          {mode === 'discount' ? (
            <SupplierField keyboardType="decimal-pad" label="Discount" selectTextOnFocus value={discountAmount} onChangeText={setDiscountAmount} />
          ) : null}
          <SupplierField label="Narration" multiline value={note} onChangeText={setNote} />
        </View>
        <Pressable disabled={isSavingTransaction} onPress={submitTransaction} style={[styles.primaryButton, isSavingTransaction && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{isSavingTransaction ? 'Saving entry...' : 'Save supplier entry'}</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle}>Recent supplier vouchers</Text>
      <View style={styles.list}>
        {transactions.slice(0, 8).map((transaction) => (
          <View key={transaction.id} style={styles.transactionRow}>
            <View style={styles.cardMain}>
              <Text style={styles.transactionTitle}>Voucher #{transaction.voucherNo} - {formatDateForBill(transaction.transactionDate)}</Text>
              <Text style={styles.cardMeta}>{supplierTransactionModeLabel(transaction.mode)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    borderColor: '#a51f3d',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 18,
  },
  backButtonText: {
    color: '#a51f3d',
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '900',
  },
  cardAmount: {
    color: '#251716',
    fontFamily: 'serif',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  cardAmountBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cardFine: {
    color: '#75665f',
    fontFamily: 'serif',
    fontSize: 12,
    fontWeight: '900',
  },
  cardMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardMeta: {
    color: '#75665f',
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '700',
  },
  cardTitle: {
    color: '#251716',
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
  disabledInput: {
    backgroundColor: '#f0e5d8',
    color: '#766b64',
  },
  emptyText: {
    color: '#7f716b',
    fontFamily: 'serif',
    fontSize: 15,
    fontWeight: '700',
    padding: 14,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: '#6c5e58',
    fontFamily: 'serif',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  formGrid: {
    gap: 12,
  },
  hero: {
    backgroundColor: '#fff',
    borderColor: '#eee',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  heroText: {
    color: '#666',
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#263238',
    fontFamily: 'serif',
    fontSize: 20,
    fontWeight: '900',
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  iconText: {
    color: '#007a66',
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#eee',
    borderRadius: 8,
    borderWidth: 1,
    color: '#263238',
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  list: {
    gap: 10,
  },
  multilineInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  page: {
    backgroundColor: '#fff',
    gap: 14,
    minHeight: '100%',
    padding: 16,
    paddingBottom: 36,
  },
  pageTitle: {
    color: '#251716',
    fontFamily: 'serif',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'right',
  },
  panel: {
    backgroundColor: '#fff',
    borderColor: '#eee',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  panelTitle: {
    color: '#251716',
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#007a66',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '900',
  },
  searchInput: {
    backgroundColor: '#fffaf3',
    borderColor: '#d8c7b8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#251716',
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchWrap: {
    backgroundColor: '#fffdf9',
    borderColor: '#e0d0c2',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  sectionTitle: {
    color: '#251716',
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '900',
  },
  segmentButton: {
    alignItems: 'center',
    backgroundColor: '#eee1d2',
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#007a66',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentText: {
    color: '#62564f',
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: '#fff',
  },
  summaryLabel: {
    color: '#736760',
    fontFamily: 'serif',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryTile: {
    backgroundColor: '#fff',
    borderRadius: 8,
    flex: 1,
    gap: 4,
    minWidth: 150,
    padding: 12,
  },
  summaryValue: {
    color: '#263238',
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '900',
  },
  supplierCard: {
    alignItems: 'center',
    backgroundColor: '#fffdf9',
    borderColor: '#e0d0c2',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  topNav: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionRow: {
    backgroundColor: '#fffdf9',
    borderColor: '#e0d0c2',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  transactionTitle: {
    color: '#251716',
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '900',
  },
});
