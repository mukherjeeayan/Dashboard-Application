# 08. Data Model & Local Storage

## 8.1 Storage location

A single SQLite file, created on first run at an OS-appropriate app-data
directory (e.g. `~/.wealthpath/wealthpath.sqlite` on macOS/Linux,
`%APPDATA%\wealthpath\wealthpath.sqlite` on Windows), resolved via the
`env-paths` npm package. This is the direct analogue of "one `.xlsm` file
holds everything" — one file, user-ownable, trivially backed up by copying
it, no server database to install.

## 8.2 Schema overview (Drizzle, SQLite dialect)

```typescript
// packages/server/db/schema.ts (illustrative)

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
  inflationLongRunMean: real("inflation_long_run_mean").notNull(),
  // ... every parameter from source Assumptions tab's 19 sections,
  //     minus the ones now sourced from the Jurisdiction Pack instead
  freezeRandomSeed: integer("freeze_random_seed", { mode: "boolean" }).notNull(),
  rngSeed: integer("rng_seed"),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  label: text("label").notNull(),
  instrumentType: text("instrument_type").notNull(), // one of the 7 InstrumentType values
  jurisdictionRuleRef: text("jurisdiction_rule_ref").notNull(),
  currency: text("currency").notNull(),
  openedDate: text("opened_date"),
  contributionRuleJson: text("contribution_rule_json").notNull(), // JSON-serialized discriminated union
  roiRuleJson: text("roi_rule_json").notNull(),
  lastUpdated: text("last_updated"),
});

export const accountBalanceHistory = sqliteTable("account_balance_history", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  periodEnd: text("period_end").notNull(), // e.g. fiscal year end
  actualBalance: real("actual_balance"),   // null until user reconciles
  projectedBalance: real("projected_balance"), // engine-computed, cached for audit/display
});

export const termDepositPositions = sqliteTable("term_deposit_positions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  principal: real("principal").notNull(),
  rate: real("rate").notNull(),
  maturityDate: text("maturity_date").notNull(),
});

// New: supports MARKET_LINKED_DIRECT and DIGITAL_ASSET accounts (§04 §4.2.1)
export const lots = sqliteTable("lots", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => accounts.id).notNull(),
  ticker: text("ticker").notNull(),
  quantity: real("quantity").notNull(),          // remaining, un-disposed quantity
  acquisitionDate: text("acquisition_date").notNull(),
  acquisitionPricePerUnit: real("acquisition_price_per_unit").notNull(),
});

export const costBasisAdjustments = sqliteTable("cost_basis_adjustments", {
  id: text("id").primaryKey(),
  lotId: text("lot_id").references(() => lots.id).notNull(),
  date: text("date").notNull(),
  type: text("type").notNull(),   // SPLIT | SPIN_OFF | HARD_FORK | AIRDROP | OTHER
  quantityMultiplier: real("quantity_multiplier"),
  note: text("note").notNull(),
});

export const lotDisposals = sqliteTable("lot_disposals", {
  id: text("id").primaryKey(),
  lotId: text("lot_id").references(() => lots.id).notNull(),
  date: text("date").notNull(),
  quantity: real("quantity").notNull(),
  pricePerUnit: real("price_per_unit").notNull(),
  realizedGain: real("realized_gain").notNull(),   // computed at entry, stored for audit/history
  realizedTax: real("realized_tax").notNull(),
});

// Manual price entries per ticker per account — the lot-based analogue of
// account_balance_history's reconciliation pattern (§8.4)
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
  description: text("description"),   // e.g. "AAPL Q2 dividend", "ETH staking reward"
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => plans.id).notNull(),
  label: text("label").notNull(),
  costToday: real("cost_today").notNull(),
  costInflationRate: real("cost_inflation_rate").notNull(),
  expectedRoi: real("expected_roi").notNull(),
  currentSavingsEarmarked: real("current_savings_earmarked").notNull().default(0),
  // Target date can be set directly OR derived from a beneficiary's age — see
  // 14-india-tool-gap-analysis.md G7 (audit of Goal Tracking sheet). Exactly
  // one of targetYear or (beneficiaryName + beneficiaryCurrentAge +
  // targetAge) is expected to be set; if the age-based fields are present,
  // targetYear is computed as currentYear + (targetAge -
  // beneficiaryCurrentAge) rather than stored redundantly.
  targetYear: integer("target_year"),
  beneficiaryName: text("beneficiary_name"),
  beneficiaryCurrentAge: integer("beneficiary_current_age"),
  targetAge: integer("target_age"),
});
export const liabilities = sqliteTable("liabilities", { /* principal, rate, tenureMonths, startDate */ });
export const insurancePolicies = sqliteTable("insurance_policies", { /* type, coverInForce, annualIncome, familySize */ });
export const majorExpenses = sqliteTable("major_expenses", { /* year, description, amountTodayValue */ });
export const monteCarloRuns = sqliteTable("monte_carlo_runs", { /* see 07-monte-carlo-engine.md §7.5 */ });
export const sequenceRiskReturns = sqliteTable("sequence_risk_returns", { /* year index, annual return — manual-entry replacement for "paste into column B"; this single series feeds BOTH the Sequence Risk screen and the Withdrawal Strategy screen (one data-entry table, not two — see 14-india-tool-gap-analysis.md C5) */ });
export const aiSettings = sqliteTable("ai_settings", { /* singleton row: enabled, provider, model, customBaseUrl, encryptedApiKey (AES-256-GCM), keyLastFour, updatedAt — see 16-ai-insights-byok.md §16.9 */ });
export const aiInsights = sqliteTable("ai_insights", { /* planId, insightType, sourceDataHash, generatedText, provider, model, generatedAt — see 16-ai-insights-byok.md §16.9 */ });
```

## 8.3 Why SQLite over a single JSON blob file

Considered and rejected: storing the whole plan as one JSON file (closest
literal analogue to "one Excel file"). Rejected because:

- `accountBalanceHistory` and `sequenceRiskReturns` are naturally
  append-only time series that benefit from real queries (e.g. "give me
  the last 5 years of reconciled balances for this account" without
  parsing/filtering a whole-plan JSON blob).
- Concurrent-safe writes: `better-sqlite3` handles this natively; a
  hand-rolled JSON-file read-modify-write cycle risks the exact kind of
  silent-overwrite bug the source workbook explicitly warns about for its
  own green-linked cells (§2.2 of source doc: "editing a linked cell... will
  be silently overwritten on the next recalculation").
- Schema migrations (adding a field to `Goal` in v1.2, say) are a
  well-trodden, reviewable path with `drizzle-kit` migrations; hand-rolled
  JSON schema versioning is a common source of silent data corruption in
  single-file-store apps.

## 8.4 Manual-entry form ↔ storage mapping

Every screen in `09-ui-ux-spec.md` that accepts input maps to exactly one
of the tables above, with Zod validation shared between the client form and
the server API handler (same schema imported on both sides — no
client/server validation drift):

| UI screen (source tab equivalent) | Table(s) written |
|---|---|
| Profile Setup | `plans` |
| Assumptions | `plan_assumptions` |
| Accounts (per instrument type) | `accounts`, `term_deposit_positions`, `lots`, `cost_basis_adjustments` |
| Buy/Sell (direct securities & crypto) | `lots` (buy), `lot_disposals` (sell) |
| Price Update (direct securities & crypto) | `ticker_price_entries` |
| Dividend / Staking Reward Entry | `yield_income_entries` |
| Balance Reconciliation | `account_balance_history` |
| Goals | `goals` |
| Liabilities | `liabilities` |
| Insurance | `insurance_policies` |
| Major Expenses | `major_expenses` |
| Sequence Risk (historical returns) | `sequence_risk_returns` |

No screen in the app writes to any table that stores **computed** output
(Projection results, Sensitivity Matrix, Scenario Analysis, risk metrics) —
those are always recomputed on read from the tables above plus the active
Jurisdiction Pack, exactly mirroring the source workbook's black-text
formula cells that must never be typed into directly (§2.2, §2.4 of source
doc). Monte Carlo results are the one exception (cached — see
`03-architecture.md` §3.5).

## 8.5 Backup / export

v1 ships a "Export Plan" button that dumps the entire SQLite file (or a
JSON snapshot derived from it) to a user-chosen location — this is
**export**, not the excluded **import** feature; a user can back up or move
their data, but the app never reads a foreign file to populate itself. Any
future "restore from export" feature is a distinct, explicitly-scoped
decision, not silently the same thing as spreadsheet import.

The `ai_settings` table (§8.2, the AI Insights API key and provider
config) is **hard-excluded** from the Export Plan flow, so a shared or
backed-up export file can never leak a credential — `ai_insights` (the
generated insight text) is included, since it's the user's own record, but
never the encrypted key. See `16-ai-insights-byok.md` §16.4/§16.9.
