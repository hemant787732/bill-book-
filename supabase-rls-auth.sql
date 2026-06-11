-- =====================================================================
-- AUTHENTICATED-ONLY RLS  (Phase 7)
-- Replaces the permissive anon policies: any LOGGED-IN user (the shop's
-- Supabase auth accounts) can read/write all shop data over a shared dataset;
-- the anon role loses access entirely.
--
-- RUN THIS ONLY AFTER:
--   1. Email auth provider is enabled in the Supabase dashboard, AND
--   2. You have at least one auth user (sign up in the app or create one in
--      Authentication → Users), AND
--   3. The app build in use has the auth-enabled client (Phase 7+).
--
-- Until you run this, the app keeps working on the existing anon policies.
-- Safe to run more than once.
-- =====================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rates','customers','item_names','bills','bill_reminders','bill_items',
    'bill_transactions','party_transactions','transaction_allocations',
    'supplier_accounts','supplier_transactions','supplier_purchase_items',
    'cash_bank_entries','market_runs','jangad_return_vouchers','jangad_return_items','devices'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- Remove the old permissive anon policies.
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%1$s" ON %1$I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%1$s" ON %1$I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%1$s" ON %1$I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%1$s" ON %1$I', t, t);

    -- One policy for all authenticated access (shared shop dataset).
    EXECUTE format('DROP POLICY IF EXISTS "auth_all_%1$s" ON %1$I', t, t);
    EXECUTE format('CREATE POLICY "auth_all_%1$s" ON %1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;
