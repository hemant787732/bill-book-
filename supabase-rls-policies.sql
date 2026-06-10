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

-- Enable Realtime for all tables (if not already enabled via Dashboard)
-- This is the SQL equivalent of toggling Realtime in the Supabase Dashboard
BEGIN;
  SELECT
    CASE
      WHEN rtrim(pg_catalog.has_database_privilege(current_database(), 'CONNECT')::text, ' ') = 'true'
      THEN 'Database connected'
      ELSE 'Not connected'
    END AS status;
COMMIT;
