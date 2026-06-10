-- Delete duplicate rate_date rows, keeping only the one with latest updated_at
DELETE FROM rates WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY rate_date ORDER BY updated_at DESC) AS rn
    FROM rates
  ) sub WHERE sub.rn = 1
);

-- Reset sync_status to 'synced' for all rows that are already synced
UPDATE rates SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE customers SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE item_names SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE bills SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE bill_reminders SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE bill_items SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE bill_transactions SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE party_transactions SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE supplier_accounts SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE supplier_transactions SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE cash_bank_entries SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE market_runs SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE jangad_return_vouchers SET sync_status = 'synced' WHERE sync_status = 'pending';
UPDATE jangad_return_items SET sync_status = 'synced' WHERE sync_status = 'pending';
