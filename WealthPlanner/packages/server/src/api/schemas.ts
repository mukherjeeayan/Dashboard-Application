// Shared Zod schemas for the API (docs/10 §10.4, Phase 4). These are the single
// source of truth for request/response validation — the client and the API
// handlers must never re-declare these shapes. Field-by-field they mirror the
// Drizzle tables in db/schema.ts (docs/08 §8.2) and the domain model
// (docs/04 §4.3).

import { z } from "zod";

// Dates travel over the wire as ISO date strings; money as whole currency
// units (REAL in the DB, up to 2 dp).

const dateString = z.string().date("Expected an ISO date (YYYY-MM-DD)");
const isoDateTime = z.string().datetime({ offset: true });
const money = z.number().finite();
const id = z.string().min(1).max(64);

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const PlanSchema = z.object({
  id,
  ownerName: z.string().max(200).nullable().optional(),
  dateOfBirth: dateString,
  targetRetirementDate: dateString,
  baseCurrency: z.string().regex(/^[A-Z]{3}$/, "3-letter ISO currency code"),
  jurisdictionPackId: z.string().min(1),
  createdAt: isoDateTime,
});

export const CreatePlanSchema = PlanSchema.pick({
  ownerName: true,
  dateOfBirth: true,
  targetRetirementDate: true,
  baseCurrency: true,
  jurisdictionPackId: true,
});

export const UpdatePlanSchema = CreatePlanSchema.partial();

// ---------------------------------------------------------------------------
// Plan Assumptions (keyed by planId — upsert semantics)
// ---------------------------------------------------------------------------

export const PlanAssumptionSchema = z.object({
  planId: id,
  marketCagr: money,
  marketVolatility: money,
  stochasticMode: z.boolean(),
  stochasticMethodology: z.string().min(1),
  inflationLongRunMean: money,
  inflationMeanReversionSpeed: money,
  inflationShockVolatility: money,
  inflationFloor: money,
  inflationCeiling: money,
  glideStartEquity: money,
  glideStep: money,
  glideFloor: money,
  lifestyleMultiplier: money,
  withdrawalWaterfallEnabled: z.boolean(),
  freezeRandomSeed: z.boolean(),
  rngSeed: z.number().int().nullable().optional(),
  trialCount: z.number().int().positive(),
  // JSON string: {"EQUITY":0.6,"DEBT":0.3,"GOLD":0.05,"CASH":0.05} (optional;
  // drives the Portfolio Risk dashboard's rebalancing suggestion, docs/06 §6.5).
  targetAllocationJson: z.string().nullable().optional(),
});

export const UpsertAssumptionSchema = PlanAssumptionSchema.omit({ planId: true });

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const AccountSchema = z.object({
  id,
  planId: id,
  label: z.string().min(1).max(200),
  instrumentType: z.string().min(1),
  positionStructure: z.string().min(1),
  liquidity: z.string().min(1),
  jurisdictionRuleRef: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/, "3-letter ISO currency code"),
  openedDate: dateString.nullable().optional(),
  contributionRuleJson: z.string().min(1),
  roiRuleJson: z.string().min(1),
  currentBalance: money.default(0),
  // JSON string: {"EQUITY":0.75,"DEBT":0.25} — per-account risk-bucket split
  // for the Portfolio Risk dashboard (docs/06 §6.5). NULL → instrument default.
  bucketSplitJson: z.string().nullable().optional(),
  lastUpdated: isoDateTime.nullable().optional(),
});

export const CreateAccountSchema = AccountSchema.omit({ id: true, planId: true });
export const UpdateAccountSchema = CreateAccountSchema.partial();

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const GoalSchema = z.object({
  id,
  planId: id,
  label: z.string().min(1).max(200),
  costToday: money,
  costInflationRate: money,
  expectedRoi: money,
  currentSavingsEarmarked: money.default(0),
  targetYear: z.number().int().nullable().optional(),
  beneficiaryName: z.string().max(200).nullable().optional(),
  beneficiaryCurrentAge: z.number().int().nullable().optional(),
  targetAge: z.number().int().nullable().optional(),
});

export const CreateGoalSchema = GoalSchema.omit({ id: true, planId: true });
export const UpdateGoalSchema = CreateGoalSchema.partial();

// ---------------------------------------------------------------------------
// Liabilities
// ---------------------------------------------------------------------------

export const LiabilitySchema = z.object({
  id,
  planId: id,
  label: z.string().min(1).max(200),
  principal: money,
  rate: money,
  tenureMonths: z.number().int().positive(),
  startDate: dateString,
});

export const CreateLiabilitySchema = LiabilitySchema.omit({ id: true, planId: true });
export const UpdateLiabilitySchema = CreateLiabilitySchema.partial();

// ---------------------------------------------------------------------------
// Insurance Policies
// ---------------------------------------------------------------------------

export const InsurancePolicySchema = z.object({
  id,
  planId: id,
  type: z.string().min(1).max(100),
  coverInForce: money,
  annualIncome: money,
  familySize: z.number().int().positive(),
});

export const CreateInsurancePolicySchema = InsurancePolicySchema.omit({ id: true, planId: true });
export const UpdateInsurancePolicySchema = CreateInsurancePolicySchema.partial();

// ---------------------------------------------------------------------------
// Major Expenses
// ---------------------------------------------------------------------------

export const MajorExpenseSchema = z.object({
  id,
  planId: id,
  year: z.number().int(),
  description: z.string().min(1).max(200),
  amountTodayValue: money,
});

export const CreateMajorExpenseSchema = MajorExpenseSchema.omit({ id: true, planId: true });
export const UpdateMajorExpenseSchema = CreateMajorExpenseSchema.partial();

// ---------------------------------------------------------------------------
// Direct Holdings (MARKET_LINKED_DIRECT / DIGITAL_ASSET): lots, disposals,
// ticker prices, and yield income (docs/09 §9.1, docs/06 §6.1, §6.9).
// ---------------------------------------------------------------------------

export const LotSchema = z.object({
  id,
  accountId: id,
  ticker: z.string().min(1).max(20),
  quantity: money,
  acquisitionDate: dateString,
  acquisitionPricePerUnit: money,
});

export const CreateLotSchema = LotSchema.omit({ id: true, accountId: true });

export const DisposalSchema = z.object({
  id,
  lotId: id,
  date: dateString,
  quantity: money,
  pricePerUnit: money,
  realizedGain: money,
  realizedTax: money,
});

export const CreateDisposalSchema = DisposalSchema.omit({ id: true });

/** Request body for the sell endpoint, which selects lots itself in FIFO order. */
export const SellRequestSchema = z.object({
  date: dateString,
  quantity: money,
  pricePerUnit: money,
});

export const TickerPriceEntrySchema = z.object({
  id,
  accountId: id,
  ticker: z.string().min(1).max(20),
  asOfDate: dateString,
  pricePerUnit: money,
});

export const CreateTickerPriceSchema = TickerPriceEntrySchema.omit({ id: true, accountId: true });

export const YieldIncomeEntrySchema = z.object({
  id,
  accountId: id,
  date: dateString,
  amount: money,
  description: z.string().max(200).nullable().optional(),
});

export const CreateYieldIncomeSchema = YieldIncomeEntrySchema.omit({ id: true, accountId: true });

// ---------------------------------------------------------------------------
// Balance Reconciliation (bulk period-end balance entry, docs/09 §9.3 step 5)
// ---------------------------------------------------------------------------

export const ReconciliationRowSchema = z.object({
  accountId: id,
  actualBalance: money,
});

export const ReconciliationSchema = z.object({
  periodEnd: dateString,
  rows: z.array(ReconciliationRowSchema).min(1),
});

// ---------------------------------------------------------------------------
// Emergency Fund (docs/09 §9.3, engine emergencyFund.ts)
// ---------------------------------------------------------------------------

export const EmergencyFundRequestSchema = z.object({
  targetCoverageMonths: z.number().positive(),
  monthlyExpense: money,
});


export type Plan = z.infer<typeof PlanSchema>;
export type PlanAssumption = z.infer<typeof PlanAssumptionSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Liability = z.infer<typeof LiabilitySchema>;
export type InsurancePolicy = z.infer<typeof InsurancePolicySchema>;
export type MajorExpense = z.infer<typeof MajorExpenseSchema>;
