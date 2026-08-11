-- 0003_add_ai_tables.sql
-- AI Insights (docs/16 §16.9). Two tables:
--   ai_settings   one-row user configuration for the BYOK LLM provider. The
--                 API key is stored only as AES-256-GCM ciphertext
--                 (encrypted_api_key) with the per-install secret kept in a
--                 file beside the DB. This table is EXCLUDED from "Export
--                 Plan" so a backup/export never contains the key or the
--                 ciphertext+key pairing.
--   ai_insights   generated insight outputs per plan, keyed by insight type.

CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  model TEXT,
  custom_base_url TEXT,
  encrypted_api_key TEXT,
  key_last_four TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  insight_type TEXT NOT NULL,
  source_data_hash TEXT NOT NULL,
  generated_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  generated_at TEXT NOT NULL
);
