-- Enable RLS on all tables (idempotent)
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_bank_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jangad_return_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jangad_return_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to run multiple times)
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_rates" ON rates; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_customers" ON customers; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_item_names" ON item_names; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_bills" ON bills; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_bill_reminders" ON bill_reminders; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_bill_items" ON bill_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_bill_transactions" ON bill_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_party_transactions" ON party_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_supplier_accounts" ON supplier_accounts; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_supplier_transactions" ON supplier_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_cash_bank_entries" ON cash_bank_entries; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_market_runs" ON market_runs; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_jangad_return_vouchers" ON jangad_return_vouchers; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_jangad_return_items" ON jangad_return_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_rates" ON rates; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_customers" ON customers; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_item_names" ON item_names; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_bills" ON bills; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_bill_reminders" ON bill_reminders; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_bill_items" ON bill_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_bill_transactions" ON bill_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_party_transactions" ON party_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_supplier_accounts" ON supplier_accounts; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_supplier_transactions" ON supplier_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_cash_bank_entries" ON cash_bank_entries; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_market_runs" ON market_runs; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_jangad_return_vouchers" ON jangad_return_vouchers; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_jangad_return_items" ON jangad_return_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_rates" ON rates; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_customers" ON customers; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_item_names" ON item_names; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_bills" ON bills; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_bill_reminders" ON bill_reminders; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_bill_items" ON bill_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_bill_transactions" ON bill_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_party_transactions" ON party_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_supplier_accounts" ON supplier_accounts; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_supplier_transactions" ON supplier_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_cash_bank_entries" ON cash_bank_entries; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_market_runs" ON market_runs; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_jangad_return_vouchers" ON jangad_return_vouchers; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_jangad_return_items" ON jangad_return_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_rates" ON rates; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_customers" ON customers; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_item_names" ON item_names; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_bills" ON bills; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_bill_reminders" ON bill_reminders; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_bill_items" ON bill_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_bill_transactions" ON bill_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_party_transactions" ON party_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_supplier_accounts" ON supplier_accounts; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_supplier_transactions" ON supplier_transactions; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_cash_bank_entries" ON cash_bank_entries; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_market_runs" ON market_runs; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_jangad_return_vouchers" ON jangad_return_vouchers; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_jangad_return_items" ON jangad_return_items; END $$;

-- Allow anon role to SELECT from all tables
CREATE POLICY "anon_select_rates" ON rates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_customers" ON customers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_item_names" ON item_names FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_bills" ON bills FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_bill_reminders" ON bill_reminders FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_bill_items" ON bill_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_bill_transactions" ON bill_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_party_transactions" ON party_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_supplier_accounts" ON supplier_accounts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_supplier_transactions" ON supplier_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_cash_bank_entries" ON cash_bank_entries FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_market_runs" ON market_runs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_jangad_return_vouchers" ON jangad_return_vouchers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_jangad_return_items" ON jangad_return_items FOR SELECT TO anon USING (true);

-- Allow anon role to INSERT into all tables
CREATE POLICY "anon_insert_rates" ON rates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_item_names" ON item_names FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_bills" ON bills FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_bill_reminders" ON bill_reminders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_bill_items" ON bill_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_bill_transactions" ON bill_transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_party_transactions" ON party_transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_supplier_accounts" ON supplier_accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_supplier_transactions" ON supplier_transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_cash_bank_entries" ON cash_bank_entries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_market_runs" ON market_runs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_jangad_return_vouchers" ON jangad_return_vouchers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_jangad_return_items" ON jangad_return_items FOR INSERT TO anon WITH CHECK (true);

-- Allow anon role to UPDATE on all tables
CREATE POLICY "anon_update_rates" ON rates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_item_names" ON item_names FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_bills" ON bills FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_bill_reminders" ON bill_reminders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_bill_items" ON bill_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_bill_transactions" ON bill_transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_party_transactions" ON party_transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_supplier_accounts" ON supplier_accounts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_supplier_transactions" ON supplier_transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_cash_bank_entries" ON cash_bank_entries FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_market_runs" ON market_runs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_jangad_return_vouchers" ON jangad_return_vouchers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_update_jangad_return_items" ON jangad_return_items FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Allow anon role to DELETE on all tables
CREATE POLICY "anon_delete_rates" ON rates FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_item_names" ON item_names FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_bills" ON bills FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_bill_reminders" ON bill_reminders FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_bill_items" ON bill_items FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_bill_transactions" ON bill_transactions FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_party_transactions" ON party_transactions FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_supplier_accounts" ON supplier_accounts FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_supplier_transactions" ON supplier_transactions FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_cash_bank_entries" ON cash_bank_entries FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_market_runs" ON market_runs FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_jangad_return_vouchers" ON jangad_return_vouchers FOR DELETE TO anon USING (true);
CREATE POLICY "anon_delete_jangad_return_items" ON jangad_return_items FOR DELETE TO anon USING (true);

-- supplier_purchase_items (purchase voucher line items)
ALTER TABLE supplier_purchase_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_supplier_purchase_items" ON supplier_purchase_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_supplier_purchase_items" ON supplier_purchase_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_supplier_purchase_items" ON supplier_purchase_items; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_supplier_purchase_items" ON supplier_purchase_items; END $$;
CREATE POLICY "anon_select_supplier_purchase_items" ON supplier_purchase_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_supplier_purchase_items" ON supplier_purchase_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_supplier_purchase_items" ON supplier_purchase_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_supplier_purchase_items" ON supplier_purchase_items FOR DELETE TO anon USING (true);

-- transaction_allocations (party transaction → bill links)
ALTER TABLE transaction_allocations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_transaction_allocations" ON transaction_allocations; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_transaction_allocations" ON transaction_allocations; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_transaction_allocations" ON transaction_allocations; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_transaction_allocations" ON transaction_allocations; END $$;
CREATE POLICY "anon_select_transaction_allocations" ON transaction_allocations FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_transaction_allocations" ON transaction_allocations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_transaction_allocations" ON transaction_allocations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_transaction_allocations" ON transaction_allocations FOR DELETE TO anon USING (true);

-- devices (logged-in device registry)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_select_devices" ON devices; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_devices" ON devices; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_update_devices" ON devices; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_delete_devices" ON devices; END $$;
CREATE POLICY "anon_select_devices" ON devices FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_devices" ON devices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_devices" ON devices FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_devices" ON devices FOR DELETE TO anon USING (true);
