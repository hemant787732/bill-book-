-- 1. RATES
CREATE TABLE IF NOT EXISTS rates (
  id TEXT PRIMARY KEY NOT NULL,
  rate_date TEXT NOT NULL UNIQUE,
  gold_10g_rate REAL NOT NULL,
  silver_1kg_rate REAL NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

-- 2. CUSTOMERS
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

-- 3. ITEM NAMES
CREATE TABLE IF NOT EXISTS item_names (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  material TEXT NOT NULL DEFAULT 'silver',
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(name, material)
);

-- 4. BILLS
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

-- 5. BILL REMINDERS
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

-- 6. MARKET RUNS
CREATE TABLE IF NOT EXISTS market_runs (
  id TEXT PRIMARY KEY NOT NULL,
  run_date TEXT NOT NULL UNIQUE,
  gold_weight REAL NOT NULL DEFAULT 0,
  silver_weight REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  actual_silver_remaining REAL NOT NULL DEFAULT 0,
  actual_gold_remaining REAL NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS market_runs_run_date_idx ON market_runs(run_date);

-- 7. BILL ITEMS
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
  supplier_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS bill_items_bill_id_idx ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS bill_items_supplier_idx ON bill_items(supplier_id);

-- 8. BILL TRANSACTIONS
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

-- 9. PARTY TRANSACTIONS
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

-- 10. JANGAD RETURN VOUCHERS
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
CREATE INDEX IF NOT EXISTS jangad_returns_bill_id_idx ON jangad_return_vouchers(bill_id);
CREATE INDEX IF NOT EXISTS jangad_returns_customer_id_idx ON jangad_return_vouchers(customer_id);

-- 11. JANGAD RETURN ITEMS
CREATE TABLE IF NOT EXISTS jangad_return_items (
  id TEXT PRIMARY KEY NOT NULL,
  voucher_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 0,
  pcs INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (voucher_id) REFERENCES jangad_return_vouchers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS jangad_return_items_voucher_id_idx ON jangad_return_items(voucher_id);

-- 12. SUPPLIER ACCOUNTS
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

-- 13. SUPPLIER TRANSACTIONS
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
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_bill_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (supplier_id) REFERENCES supplier_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS supplier_transactions_supplier_id_idx ON supplier_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS supplier_transactions_source_bill_idx ON supplier_transactions(source_bill_id);

-- 13b. SUPPLIER PURCHASE ITEMS
CREATE TABLE IF NOT EXISTS supplier_purchase_items (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL DEFAULT '',
  line_no INTEGER NOT NULL DEFAULT 0,
  item_name TEXT NOT NULL DEFAULT '',
  pcs TEXT NOT NULL DEFAULT '',
  weight TEXT NOT NULL DEFAULT '',
  touch TEXT NOT NULL DEFAULT '',
  fine TEXT NOT NULL DEFAULT '',
  rate TEXT NOT NULL DEFAULT '',
  amount TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (transaction_id) REFERENCES supplier_transactions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS supplier_purchase_items_txn_idx ON supplier_purchase_items(transaction_id);
CREATE INDEX IF NOT EXISTS supplier_purchase_items_supplier_idx ON supplier_purchase_items(supplier_id);

-- 13c. TRANSACTION ALLOCATIONS (party transaction → bill links)
CREATE TABLE IF NOT EXISTS transaction_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL,
  customer_id TEXT NOT NULL DEFAULT '',
  bill_id TEXT NOT NULL DEFAULT '',
  bill_no INTEGER NOT NULL DEFAULT 0,
  fine_alloc REAL NOT NULL DEFAULT 0,
  amount_alloc REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (transaction_id) REFERENCES party_transactions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS transaction_allocations_txn_idx ON transaction_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS transaction_allocations_customer_idx ON transaction_allocations(customer_id);
CREATE INDEX IF NOT EXISTS transaction_allocations_bill_idx ON transaction_allocations(bill_id);

-- 14. CASH BANK ENTRIES
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

-- 15. DEVICES (logged-in device registry / remote sign-out)
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  user_email TEXT NOT NULL DEFAULT '',
  device_name TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  last_seen TEXT NOT NULL DEFAULT '',
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_email);

-- =====================================================================
-- COLUMN MIGRATIONS for existing deployments (CREATE TABLE IF NOT EXISTS
-- above is a no-op once a table exists, so add new columns explicitly).
-- Safe to run repeatedly.
-- =====================================================================
ALTER TABLE bill_items            ADD COLUMN IF NOT EXISTS supplier_id TEXT NOT NULL DEFAULT '';
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS source_bill_id TEXT NOT NULL DEFAULT '';
ALTER TABLE market_runs           ADD COLUMN IF NOT EXISTS actual_silver_remaining REAL NOT NULL DEFAULT 0;
ALTER TABLE market_runs           ADD COLUMN IF NOT EXISTS actual_gold_remaining REAL NOT NULL DEFAULT 0;
ALTER TABLE market_runs           ADD COLUMN IF NOT EXISTS closed INTEGER NOT NULL DEFAULT 0;

-- =====================================================================
-- REALTIME
-- Pushes every insert/update/delete to all connected devices over a
-- websocket, so a bill created on one phone shows up on another in well
-- under a second. WITHOUT this block the app will only sync on restart.
-- Run this in the Supabase SQL editor. Safe to run more than once.
-- =====================================================================

-- Full old-row image in UPDATE/DELETE events so other devices can apply
-- deletes correctly and row-level security can authorize the change.
ALTER TABLE rates                  REPLICA IDENTITY FULL;
ALTER TABLE customers              REPLICA IDENTITY FULL;
ALTER TABLE item_names             REPLICA IDENTITY FULL;
ALTER TABLE bills                  REPLICA IDENTITY FULL;
ALTER TABLE bill_reminders         REPLICA IDENTITY FULL;
ALTER TABLE bill_items             REPLICA IDENTITY FULL;
ALTER TABLE bill_transactions      REPLICA IDENTITY FULL;
ALTER TABLE party_transactions     REPLICA IDENTITY FULL;
ALTER TABLE supplier_accounts      REPLICA IDENTITY FULL;
ALTER TABLE supplier_transactions  REPLICA IDENTITY FULL;
ALTER TABLE supplier_purchase_items REPLICA IDENTITY FULL;
ALTER TABLE transaction_allocations REPLICA IDENTITY FULL;
ALTER TABLE cash_bank_entries      REPLICA IDENTITY FULL;
ALTER TABLE market_runs            REPLICA IDENTITY FULL;
ALTER TABLE devices                REPLICA IDENTITY FULL;

-- Add each synced table to the realtime publication (ignored if already added).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rates','customers','item_names','bills','bill_reminders','bill_items',
    'bill_transactions','party_transactions','supplier_accounts',
    'supplier_transactions','supplier_purchase_items','transaction_allocations','cash_bank_entries','market_runs','devices'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- table already part of the publication; nothing to do
      NULL;
    END;
  END LOOP;
END $$;

-- NOTE on row-level security: if RLS is enabled on these tables, realtime only
-- delivers rows the anon key is allowed to SELECT. The app already reads/writes
-- with the anon key, so a permissive SELECT policy (USING (true)) must exist for
-- each table above — otherwise other devices receive nothing.
