-- 0002_add_account_bucket_split.sql
-- Optional per-account risk-bucket split for the Portfolio Risk dashboard
-- (docs/06 §6.5, source §3.7). Stored as a JSON string mapping risk bucket ->
-- fraction, e.g. {"EQUITY":0.75,"DEBT":0.25} for a sleeve that is 75% equity.
-- NULL means "use the instrument-type default mapping".

ALTER TABLE accounts ADD COLUMN bucket_split_json TEXT;
