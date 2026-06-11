import { LocalDatabase } from './dbTypes';
import { supabase } from './supabase';

const BILL_TYPES = ['estimate', 'jangad'] as const;
const METAL_TYPES = ['silver', 'gold'] as const;
const LANGUAGES = ['en', 'hi', 'gu'] as const;
const RECEIPT_TYPES = ['none', 'fine', 'cash', 'fine_cash'] as const;
const RECEIPT_MATERIALS = ['silver', 'gold'] as const;
const BILL_TXN_MODES = ['cash', 'bank', 'split', 'fine', 'rate_cut'] as const;
const PARTY_TXN_MODES = ['cash', 'bank', 'split', 'fine', 'fine_rec', 'payment', 'discount'] as const;
const SUPPLIER_TXN_MODES = ['cash_payment', 'bank_payment', 'split_payment', 'metal_paid', 'purchase', 'discount'] as const;
const CASH_BANK_MODES = ['cash', 'bank'] as const;
const LABOUR_TYPES = ['gw', 'pcs'] as const;
const REMINDER_STATUSES = ['active', 'done'] as const;
const ENTRY_STATUSES = ['pending', 'entered'] as const;

export const TABLES = [
  'rates',
  'customers',
  'item_names',
  'bills',
  'bill_reminders',
  'bill_items',
  'bill_transactions',
  'party_transactions',
  'supplier_accounts',
  'supplier_transactions',
  'supplier_purchase_items',
  'transaction_allocations',
  'cash_bank_entries',
  'market_runs',
  'devices',
] as const;

type SyncResult = { ok: boolean; message?: string };

function oneOf<T>(value: T, options: readonly T[], label: string): T {
  if (!options.includes(value)) {
    console.warn(`sync: invalid ${label}: "${value}", defaulting to "${options[0]}"`);
    return options[0];
  }
  return value;
}

function number(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function text(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

// ---------------------------------------------------------------------------
// Immediate (event-driven) upload — pushes a local change to Supabase the
// instant it is written, instead of waiting for the periodic timer. Debounced
// so the multiple rows of one bill (bill + items + transactions) go up in a
// single upload. This is what gets a change onto other devices in < 1 second.
// ---------------------------------------------------------------------------
let uploadKickTimer: ReturnType<typeof setTimeout> | null = null;
let uploadInFlight = false;
let dirtyDuringUpload = false;
let kickDb: LocalDatabase | null = null;

async function runUploadKick(): Promise<void> {
  uploadKickTimer = null;
  if (!kickDb) return;
  uploadInFlight = true;
  dirtyDuringUpload = false;
  try {
    await uploadPendingChanges(kickDb);
  } finally {
    uploadInFlight = false;
    if (dirtyDuringUpload) scheduleImmediateUpload(kickDb);
  }
}

export function scheduleImmediateUpload(db: LocalDatabase): void {
  if (!supabase) return;
  kickDb = db;
  // A change arrived while an upload is running — re-run once it finishes so
  // nothing is left behind.
  if (uploadInFlight) {
    dirtyDuringUpload = true;
    return;
  }
  // Coalesce a burst of writes into one upload (fires ~250ms after the first).
  if (uploadKickTimer) return;
  uploadKickTimer = setTimeout(() => { void runUploadKick(); }, 250);
}

export async function upsertRows(db: LocalDatabase, table: string, rows: Record<string, any>[], conflictKey: string): Promise<void> {
  if (!rows.length) return;
  const queries = rows.map(row => {
    const keys = Object.keys(row);
    const placeholders = keys.map(() => '?').join(', ');
    const updates = keys.map(k => `"${k}" = excluded."${k}"`).join(', ');
    return {
      sql: `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders}) ON CONFLICT("${conflictKey}") DO UPDATE SET ${updates}`,
      args: keys.map(k => row[k]),
    };
  });
  for (const q of queries) {
    await db.runAsync(q.sql, q.args);
  }
}

async function upsertOptionalRows(db: LocalDatabase, table: string, rows: Record<string, any>[], conflictKey: string): Promise<void> {
  if (!rows.length) return;
  await upsertRows(db, table, rows, conflictKey);
}

export async function markTableRowsSynced(db: LocalDatabase, table: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`UPDATE "${table}" SET sync_status = 'synced' WHERE id IN (${placeholders})`, ids);
}

export function sanitizeRow(table: string, row: any): Record<string, any> {
  const r: Record<string, any> = {};

  switch (table) {
    case 'rates':
      r.id = text(row.id);
      r.rate_date = text(row.rate_date);
      r.gold_10g_rate = number(row.gold_10g_rate);
      r.silver_1kg_rate = number(row.silver_1kg_rate);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'customers':
      r.id = text(row.id);
      r.name = text(row.name);
      r.mobile = text(row.mobile);
      r.address = text(row.address);
      r.opening_fine_balance = number(row.opening_fine_balance);
      r.opening_labour_balance = number(row.opening_labour_balance);
      r.opening_note = text(row.opening_note);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'item_names':
      r.id = text(row.id);
      r.name = text(row.name);
      r.material = oneOf(text(row.material), METAL_TYPES, 'metal_type');
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'bills':
      r.id = text(row.id);
      r.bill_no = number(row.bill_no);
      r.bill_date = text(row.bill_date);
      r.bill_type = oneOf(text(row.bill_type), BILL_TYPES, 'bill_type');
      r.customer_id = text(row.customer_id);
      r.customer_name = text(row.customer_name);
      r.customer_mobile = text(row.customer_mobile);
      r.customer_address = text(row.customer_address);
      r.display_opening_fine_balance = number(row.display_opening_fine_balance);
      r.display_opening_labour_balance = number(row.display_opening_labour_balance);
      r.display_opening_note = text(row.display_opening_note);
      r.language = oneOf(text(row.language), LANGUAGES, 'language');
      r.subtotal = number(row.subtotal);
      r.receipt_type = oneOf(text(row.receipt_type), RECEIPT_TYPES, 'receipt_type');
      r.receipt_material = oneOf(text(row.receipt_material), RECEIPT_MATERIALS, 'receipt_material');
      r.received_gross_weight = number(row.received_gross_weight);
      r.received_touch = number(row.received_touch);
      r.received_fine = number(row.received_fine);
      r.received_cash = number(row.received_cash);
      r.received_price_override = number(row.received_price_override);
      r.received_value = number(row.received_value);
      r.rate_cut_fine = number(row.rate_cut_fine);
      r.rate_cut_amount = number(row.rate_cut_amount);
      r.rate_cut_adjusts_labour = number(row.rate_cut_adjusts_labour);
      r.rate_cut_booked_rate = number(row.rate_cut_booked_rate);
      r.discount_amount = number(row.discount_amount);
      r.net_total = number(row.net_total);
      r.entry_status = oneOf(text(row.entry_status), ENTRY_STATUSES, 'entry_status');
      r.entered_at = text(row.entered_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'bill_reminders':
      r.id = text(row.id);
      r.bill_id = text(row.bill_id);
      r.bill_no = number(row.bill_no);
      r.customer_name = text(row.customer_name);
      r.customer_mobile = text(row.customer_mobile);
      r.due_at = text(row.due_at);
      r.status = oneOf(text(row.status), REMINDER_STATUSES, 'reminder_status');
      r.extended_count = number(row.extended_count);
      r.notification_id = text(row.notification_id);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'bill_items':
      r.id = text(row.id);
      r.bill_id = text(row.bill_id);
      r.line_no = number(row.line_no);
      r.material = oneOf(text(row.material), METAL_TYPES, 'metal_type');
      r.item_name = text(row.item_name);
      r.weight = text(row.weight);
      r.packet_less = text(row.packet_less);
      r.touch = text(row.touch);
      r.fine = text(row.fine);
      r.pcs = text(row.pcs);
      r.rate = text(row.rate);
      r.labour_type = oneOf(text(row.labour_type), LABOUR_TYPES, 'labour_type');
      r.labour = text(row.labour);
      r.other = text(row.other);
      r.amount = text(row.amount);
      r.supplier_id = text(row.supplier_id);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'bill_transactions':
      r.id = text(row.id);
      r.bill_id = text(row.bill_id);
      r.transaction_date = text(row.transaction_date);
      r.mode = oneOf(text(row.mode), BILL_TXN_MODES, 'bill_txn_mode');
      r.cash_amount = number(row.cash_amount);
      r.bank_amount = number(row.bank_amount);
      r.fine_weight = number(row.fine_weight);
      r.rate_cut_fine = number(row.rate_cut_fine);
      r.rate_cut_amount = number(row.rate_cut_amount);
      r.booked_rate = number(row.booked_rate);
      r.material = oneOf(text(row.material), METAL_TYPES, 'metal_type');
      r.amount = number(row.amount);
      r.note = text(row.note);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'party_transactions':
      r.id = text(row.id);
      r.customer_id = text(row.customer_id);
      r.voucher_no = number(row.voucher_no);
      r.transaction_date = text(row.transaction_date);
      r.mode = oneOf(text(row.mode), PARTY_TXN_MODES, 'party_txn_mode');
      r.material = oneOf(text(row.material), METAL_TYPES, 'metal_type');
      r.cash_amount = number(row.cash_amount);
      r.bank_amount = number(row.bank_amount);
      r.fine_weight = number(row.fine_weight);
      r.booked_rate = number(row.booked_rate);
      r.fine_value = number(row.fine_value);
      r.payment_amount = number(row.payment_amount);
      r.discount_amount = number(row.discount_amount);
      r.note = text(row.note);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'supplier_accounts':
      r.id = text(row.id);
      r.entry_date = text(row.entry_date);
      r.name = text(row.name);
      r.mobile = text(row.mobile);
      r.address = text(row.address);
      r.opening_fine_payable = number(row.opening_fine_payable);
      r.opening_amount_payable = number(row.opening_amount_payable);
      r.opening_note = text(row.opening_note);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'supplier_transactions':
      r.id = text(row.id);
      r.supplier_id = text(row.supplier_id);
      r.voucher_no = number(row.voucher_no);
      r.transaction_date = text(row.transaction_date);
      r.mode = oneOf(text(row.mode), SUPPLIER_TXN_MODES, 'supplier_txn_mode');
      r.material = oneOf(text(row.material), METAL_TYPES, 'metal_type');
      r.fine_weight = number(row.fine_weight);
      r.booked_rate = number(row.booked_rate);
      r.fine_value = number(row.fine_value);
      r.cash_amount = number(row.cash_amount);
      r.bank_amount = number(row.bank_amount);
      r.discount_amount = number(row.discount_amount);
      r.note = text(row.note);
      r.source_type = text(row.source_type) || 'manual';
      r.source_bill_id = text(row.source_bill_id);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'supplier_purchase_items':
      r.id = text(row.id);
      r.transaction_id = text(row.transaction_id);
      r.supplier_id = text(row.supplier_id);
      r.line_no = number(row.line_no);
      r.item_name = text(row.item_name);
      r.pcs = text(row.pcs);
      r.weight = text(row.weight);
      r.touch = text(row.touch);
      r.fine = text(row.fine);
      r.rate = text(row.rate);
      r.amount = text(row.amount);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'transaction_allocations':
      r.id = text(row.id);
      r.transaction_id = text(row.transaction_id);
      r.customer_id = text(row.customer_id);
      r.bill_id = text(row.bill_id);
      r.bill_no = number(row.bill_no);
      r.fine_alloc = number(row.fine_alloc);
      r.amount_alloc = number(row.amount_alloc);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'cash_bank_entries':
      r.id = text(row.id);
      r.entry_date = text(row.entry_date);
      r.mode = oneOf(text(row.mode), CASH_BANK_MODES, 'cash_bank_mode');
      r.particular = text(row.particular);
      r.party = text(row.party);
      r.receipt_amount = number(row.receipt_amount);
      r.payment_amount = number(row.payment_amount);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'market_runs':
      r.id = text(row.id);
      r.run_date = text(row.run_date);
      r.gold_weight = number(row.gold_weight);
      r.silver_weight = number(row.silver_weight);
      r.note = text(row.note);
      r.actual_silver_remaining = number(row.actual_silver_remaining);
      r.actual_gold_remaining = number(row.actual_gold_remaining);
      r.closed = number(row.closed);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
    case 'devices':
      r.id = text(row.id);
      r.device_id = text(row.device_id);
      r.user_email = text(row.user_email);
      r.device_name = text(row.device_name);
      r.platform = text(row.platform);
      r.last_seen = text(row.last_seen);
      r.revoked = number(row.revoked);
      r.created_at = text(row.created_at);
      r.updated_at = text(row.updated_at);
      r.sync_status = 'synced';
      break;
  }

  return r;
}

async function downloadFromSupabase(db: LocalDatabase): Promise<string[]> {
  if (!supabase) return [];
  const errors: string[] = [];

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      if (!data || !data.length) continue;

      const pendingRows = await db.getAllAsync<{ id: string }>(`SELECT id FROM "${table}" WHERE sync_status = 'pending'`);
      const pendingIds = new Set(pendingRows.map((r: { id: string }) => r.id));

      const rowsToInsert = data.filter((r: Record<string, any>) => !pendingIds.has(r.id)).map((r: Record<string, any>) => sanitizeRow(table, r));
      if (rowsToInsert.length) {
        await upsertRows(db, table, rowsToInsert, 'id');
      }
    } catch (err) {
      errors.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return errors;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch {}
  return String(err);
}

function isDuplicateKeyError(err: unknown): boolean {
  const msg = formatError(err).toLowerCase();
  return msg.includes('duplicate key') || msg.includes('23505') || msg.includes('409');
}

async function uploadToSupabase(db: LocalDatabase): Promise<string[]> {
  if (!supabase) return [];
  const errors: string[] = [];

  for (const table of TABLES) {
    let pendingRows: any[] = [];
    try {
      pendingRows = await db.getAllAsync(`SELECT * FROM "${table}" WHERE sync_status = 'pending'`);
      if (!pendingRows.length) continue;

      const supabaseRows = pendingRows.map((row: any) => {
        const { sync_status, ...rest } = row;
        return rest;
      });

      const { error } = await supabase.from(table).upsert(supabaseRows, { onConflict: 'id' });
      if (error) throw error;

      await markTableRowsSynced(db, table, pendingRows.map((r: any) => r.id));
    } catch (err) {
      // If duplicate key (409), mark as synced to stop retry loop
      if (isDuplicateKeyError(err) && pendingRows.length) {
        try {
          await markTableRowsSynced(db, table, pendingRows.map((r: any) => r.id));
          console.warn(`Upload ${table}: duplicate key, marked ${pendingRows.length} row(s) synced`);
        } catch {}
      } else {
        errors.push(`${table}: ${formatError(err)}`);
        console.warn(`Upload error for ${table}:`, err);
      }
    }
  }

  return errors;
}

export async function uploadPendingChanges(db: LocalDatabase): Promise<SyncResult> {
  try {
    const errors = await uploadToSupabase(db);
    if (errors.length) {
      return { ok: false, message: errors.join('; ') };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Upload failed' };
  }
}

export async function syncPendingChanges(db: LocalDatabase): Promise<SyncResult> {
  try {
    const uploadErrors = await uploadToSupabase(db);
    const downloadErrors = await downloadFromSupabase(db);
    const allErrors = [...uploadErrors, ...downloadErrors];
    if (allErrors.length) {
      return { ok: false, message: allErrors.join('; ') };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Sync failed' };
  }
}

export async function downloadRowsByIds(db: LocalDatabase, table: string, ids: string[]): Promise<string[]> {
  if (!supabase || !ids.length) return [];
  const errors: string[] = [];
  try {
    const { data, error } = await supabase.from(table).select('*').in('id', ids);
    if (error) throw error;
    if (!data || !data.length) return errors;
    const rows = data.map((r: Record<string, any>) => sanitizeRow(table, r));
    if (rows.length) {
      await upsertRows(db, table, rows, 'id');
    }
  } catch (err) {
    errors.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return errors;
}

export async function restoreFromSupabaseBackup(db: LocalDatabase): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.' };
  try {
    const errors: string[] = [];
    for (const table of TABLES) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        if (!data || !data.length) continue;
        const rows = data.map((r: Record<string, any>) => sanitizeRow(table, r));
        if (rows.length) {
          await upsertRows(db, table, rows, 'id');
        }
      } catch (err) {
        errors.push(`${table}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (errors.length) {
      return { ok: false, message: `Restore had errors: ${errors.join('; ')}` };
    }
    return { ok: true, message: 'Supabase data restored successfully.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Restore failed' };
  }
}
