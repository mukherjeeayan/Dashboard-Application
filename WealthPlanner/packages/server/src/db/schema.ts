import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Local database schema (docs/08-data-model-and-storage.md §8.2).
// Financial amounts are stored as REAL (whole currency units, up to 2 dp).

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  ownerName: text("owner_name"),
  dateOfBirth: text("date_of_birth").notNull(),
  targetRetirementDate: text("target_retirement_date").notNull(),
  baseCurrency: text("base_currency").notNull(),
  jurisdictionPackId: text("jurisdiction_pack_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const planAssumptions = sqliteTable("plan_assumptions", {
  planId: text("plan_id").references(() => plans.id).primaryKey(),
  marketCagr: real("market_cagr").notNull(),
  marketVolatility: real("market_volatility").notNull(),
  stochasticMode: integer("stochastic_mode", { mode: "boolean" }).notNull(),
  stochasticMethodology: text("stochastic_methodology").notNull(),
  inflationLongRunMean: real("inflation_long_run_mean").notNull(),
  inflationMeanReversionSpeed: real("inflation_mean_reversion_speed").notNull(),
  inflationShockVolatility: real("inflation_shock_volatility").notNull(),
  inflationFloor: real("inflation_floor").notNull(),
  inflationCeiling: real("inflation_ceiling").notNull(),
  glideStartEquity: real("glide_start_equity").notNull(),
  glideStep: real("glide_step").notNull(),
  glideFloor: real("glide_floor").notNull(),
  lifestyleMultiplier: real("lifestyle_multiplier").notNull(),
  withdrawalWaterfallEnabled: integer("withdrawal_waterfall_enabled", { mode: "boolean" }).notNull(),
  freezeRandomSeed: integer("freeze_random_seed", { mode: "boolean" }).notNull(),
  rngSeed: integer("rng_seed"),
  trialCount: integer("trial_count").notNull(),
  targetAllocationJson: text("target_allocation_json"),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  label: text("label").notNull(),
  instrumentType: text("instrument_type").notNull(),
  positionStructure: text("position_structure").notNull(),
  liquidity: text("liquidity").notNull(),
  jurisdictionRuleRef: text("jurisdiction_rule_ref").notNull(),
  currency: text("currency").notNull(),
  openedDate: text("opened_date"),
  contributionRuleJson: text("contribution_rule_json").notNull(),
  roiRuleJson: text("roi_rule_json").notNull(),
  currentBalance: real("current_balance").notNull().default(0),
  bucketSplitJson: text("bucket_split_json"),
  lastUpdated: text("last_updated"),
});

export const accountBalanceHistory = sqliteTable("account_balance_history", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  periodEnd: text("period_end").notNull(),
  actualBalance: real("actual_balance"),
  projectedBalance: real("projected_balance"),
});

export const oneTimeAdjustments = sqliteTable("one_time_adjustments", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
  linkedTransferRef: text("linked_transfer_ref"),
});

export const termDepositPositions = sqliteTable("term_deposit_positions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  principal: real("principal").notNull(),
  rate: real("rate").notNull(),
  maturityDate: text("maturity_date").notNull(),
});

export const lots = sqliteTable("lots", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  ticker: text("ticker").notNull(),
  quantity: real("quantity").notNull(),
  acquisitionDate: text("acquisition_date").notNull(),
  acquisitionPricePerUnit: real("acquisition_price_per_unit").notNull(),
});

export const costBasisAdjustments = sqliteTable("cost_basis_adjustments", {
  id: text("id").primaryKey(),
  lotId: text("lot_id").references(() => lots.id).notNull(),
  date: text("date").notNull(),
  type: text("type").notNull(),
  quantityMultiplier: real("quantity_multiplier"),
  note: text("note").notNull(),
});

export const lotDisposals = sqliteTable("lot_disposals", {
  id: text("id").primaryKey(),
  lotId: text("lot_id").references(() => lots.id).notNull(),
  date: text("date").notNull(),
  quantity: real("quantity").notNull(),
  pricePerUnit: real("price_per_unit").notNull(),
  realizedGain: real("realized_gain").notNull(),
  realizedTax: real("realized_tax").notNull(),
});

export const tickerPriceEntries = sqliteTable("ticker_price_entries", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  ticker: text("ticker").notNull(),
  asOfDate: text("as_of_date").notNull(),
  pricePerUnit: real("price_per_unit").notNull(),
});

export const yieldIncomeEntries = sqliteTable("yield_income_entries", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  description: text("description"),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  label: text("label").notNull(),
  costToday: real("cost_today").notNull(),
  costInflationRate: real("cost_inflation_rate").notNull(),
  expectedRoi: real("expected_roi").notNull(),
  currentSavingsEarmarked: real("current_savings_earmarked").notNull().default(0),
  targetYear: integer("target_year"),
  beneficiaryName: text("beneficiary_name"),
  beneficiaryCurrentAge: integer("beneficiary_current_age"),
  targetAge: integer("target_age"),
});

export const liabilities = sqliteTable("liabilities", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  label: text("label").notNull(),
  principal: real("principal").notNull(),
  rate: real("rate").notNull(),
  tenureMonths: integer("tenure_months").notNull(),
  startDate: text("start_date").notNull(),
});

export const insurancePolicies = sqliteTable("insurance_policies", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  type: text("type").notNull(),
  coverInForce: real("cover_in_force").notNull(),
  annualIncome: real("annual_income").notNull(),
  familySize: integer("family_size").notNull(),
});

export const majorExpenses = sqliteTable("major_expenses", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  year: integer("year").notNull(),
  description: text("description").notNull(),
  amountTodayValue: real("amount_today_value").notNull(),
});

export const monteCarloRuns = sqliteTable("monte_carlo_runs", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  engine: text("engine").notNull(),
  planSnapshotHash: text("plan_snapshot_hash").notNull(),
  trialCount: integer("trial_count").notNull(),
  seed: integer("seed"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status").notNull(),
  resultSummaryJson: text("result_summary_json"),
  errorMessage: text("error_message"),
});

export const sequenceRiskReturns = sqliteTable("sequence_risk_returns", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  yearIndex: integer("year_index").notNull(),
  annualReturn: real("annual_return").notNull(),
});

// AI Insights (docs/16 §16.9). Single-settings-row store for the user's own
// provider credentials; `encrypted_api_key` holds AES-256-GCM ciphertext, never
// plaintext, and this table is excluded from the "Export Plan" flow.

export const aiSettings = sqliteTable("ai_settings", {
  id: text("id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  provider: text("provider"),
  model: text("model"),
  customBaseUrl: text("custom_base_url"),
  encryptedApiKey: text("encrypted_api_key"),
  keyLastFour: text("key_last_four"),
  updatedAt: text("updated_at").notNull(),
});

export const aiInsights = sqliteTable("ai_insights", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  insightType: text("insight_type").notNull(),
  sourceDataHash: text("source_data_hash").notNull(),
  generatedText: text("generated_text").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  generatedAt: text("generated_at").notNull(),
});
