-- 0000_init.sql
-- Initial schema, mirroring packages/server/src/db/schema.ts.
-- Financial amounts are REAL (whole currency units, up to 2 dp).

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  owner_name TEXT,
  date_of_birth TEXT NOT NULL,
  target_retirement_date TEXT NOT NULL,
  base_currency TEXT NOT NULL,
  jurisdiction_pack_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_assumptions (
  plan_id TEXT PRIMARY KEY REFERENCES plans(id),
  market_cagr REAL NOT NULL,
  market_volatility REAL NOT NULL,
  stochastic_mode INTEGER NOT NULL,
  stochastic_methodology TEXT NOT NULL,
  inflation_long_run_mean REAL NOT NULL,
  inflation_mean_reversion_speed REAL NOT NULL,
  inflation_shock_volatility REAL NOT NULL,
  inflation_floor REAL NOT NULL,
  inflation_ceiling REAL NOT NULL,
  glide_start_equity REAL NOT NULL,
  glide_step REAL NOT NULL,
  glide_floor REAL NOT NULL,
  lifestyle_multiplier REAL NOT NULL,
  withdrawal_waterfall_enabled INTEGER NOT NULL,
  freeze_random_seed INTEGER NOT NULL,
  rng_seed INTEGER,
  trial_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  label TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  position_structure TEXT NOT NULL,
  liquidity TEXT NOT NULL,
  jurisdiction_rule_ref TEXT NOT NULL,
  currency TEXT NOT NULL,
  opened_date TEXT,
  contribution_rule_json TEXT NOT NULL,
  roi_rule_json TEXT NOT NULL,
  current_balance REAL NOT NULL DEFAULT 0,
  last_updated TEXT
);

CREATE TABLE IF NOT EXISTS account_balance_history (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  period_end TEXT NOT NULL,
  actual_balance REAL,
  projected_balance REAL
);

CREATE TABLE IF NOT EXISTS one_time_adjustments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  linked_transfer_ref TEXT
);

CREATE TABLE IF NOT EXISTS term_deposit_positions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  principal REAL NOT NULL,
  rate REAL NOT NULL,
  maturity_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  ticker TEXT NOT NULL,
  quantity REAL NOT NULL,
  acquisition_date TEXT NOT NULL,
  acquisition_price_per_unit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_basis_adjustments (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL REFERENCES lots(id),
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity_multiplier REAL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lot_disposals (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL REFERENCES lots(id),
  date TEXT NOT NULL,
  quantity REAL NOT NULL,
  price_per_unit REAL NOT NULL,
  realized_gain REAL NOT NULL,
  realized_tax REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ticker_price_entries (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  ticker TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  price_per_unit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS yield_income_entries (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  label TEXT NOT NULL,
  cost_today REAL NOT NULL,
  cost_inflation_rate REAL NOT NULL,
  expected_roi REAL NOT NULL,
  current_savings_earmarked REAL NOT NULL DEFAULT 0,
  target_year INTEGER,
  beneficiary_name TEXT,
  beneficiary_current_age INTEGER,
  target_age INTEGER
);

CREATE TABLE IF NOT EXISTS liabilities (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  label TEXT NOT NULL,
  principal REAL NOT NULL,
  rate REAL NOT NULL,
  tenure_months INTEGER NOT NULL,
  start_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  type TEXT NOT NULL,
  cover_in_force REAL NOT NULL,
  annual_income REAL NOT NULL,
  family_size INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS major_expenses (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  year INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount_today_value REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS monte_carlo_runs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  engine TEXT NOT NULL,
  plan_snapshot_hash TEXT NOT NULL,
  trial_count INTEGER NOT NULL,
  seed INTEGER,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  result_summary_json TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS sequence_risk_returns (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  year_index INTEGER NOT NULL,
  annual_return REAL NOT NULL
);
