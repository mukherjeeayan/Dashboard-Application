// Projects a stored plan (rows in the local DB) into the pure engine input for
// the single-blended engine (docs/07 §7.2, docs/08 §8.2). This keeps the HTTP
// layer thin: routes only pass `{ planId, engine, overrides }` and the builder
// materialises the full `SingleBlendedInput` from persisted accounts,
// assumptions and goals. Every derived value can be overridden explicitly.

import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { accounts, majorExpenses, planAssumptions, plans } from "../db/schema";
import {
  INSTRUMENT_TYPES,
  type InstrumentType,
} from "@wealthpath/jurisdictions";

export interface Overrides {
  fixedIncomeROI?: number;
  inflation?: number;
  marketMean?: number;
  marketVol?: number;
  crashFloor?: number;
  trialCount?: number;
  years?: number;
  seed?: number | null;
  yearlyExpenditure?: number;
}

export interface PlanProjection {
  /** Total present value of fixed-income sleeve accounts (whole currency units). */
  fixedIncomeSleeve: number;
  /** Total present value of market sleeve accounts (whole currency units). */
  marketSleeve: number;
  yearlyExpenditure: number;
  fixedIncomeROI: number;
  inflation: number;
  marketMean: number;
  marketVol: number;
  crashFloor: number;
  trialCount: number;
  years: number;
  seed?: number;
}

// Instrument types whose returns are (near-)deterministic / capital-preserving
// and therefore assigned to the fixed-income sleeve.
const FIXED_INCOME: ReadonlySet<InstrumentType> = new Set([
  "GOV_SAFE_LOCKED",
  "EMPLOYER_MANDATORY_LOCKED",
  "EMPLOYER_DISCRETIONARY_LOCKED",
  "FIXED_TERM_DEPOSIT",
  "LIQUID_CASH",
]);

const DEFAULT_CRASH_FLOOR = -0.6;

function isInstrumentType(v: string): v is InstrumentType {
  return (INSTRUMENT_TYPES as readonly string[]).includes(v);
}

function classify(instrumentType: string): "fixed" | "market" {
  return isInstrumentType(instrumentType) && FIXED_INCOME.has(instrumentType)
    ? "fixed"
    : "market";
}

/** Years from today until the plan's target retirement date (>= 1). */
function horizonYears(targetRetirementDate: string, asOf = new Date()): number {
  const target = new Date(targetRetirementDate).getUTCFullYear();
  const now = asOf.getUTCFullYear();
  return Math.max(1, target - now);
}

/**
 * Builds the engine input for a plan. Returns null when the plan (or its
 * assumptions row) does not exist. `overrides` win over derived values and the
 * plan's persisted `trialCount` wins over the default.
 */
export function projectSingleBlended(
  db: Db,
  planId: string,
  overrides: Overrides = {},
): PlanProjection | null {
  const [plan] = db.select().from(plans).where(eq(plans.id, planId)).limit(1).all();
  if (!plan) return null;

  const [assumptions] = db
    .select()
    .from(planAssumptions)
    .where(eq(planAssumptions.planId, planId))
    .limit(1)
    .all();

  const planAccounts = db
    .select()
    .from(accounts)
    .where(eq(accounts.planId, planId))
    .all();

  let fixedIncomeSleeve = 0;
  let marketSleeve = 0;
  for (const account of planAccounts) {
    const balance = account.currentBalance ?? 0;
    if (classify(account.instrumentType) === "fixed") fixedIncomeSleeve += balance;
    else marketSleeve += balance;
  }

  // First projection year's major expense, if any, else 0 (overridable).
  const [firstExpense] = db
    .select()
    .from(majorExpenses)
    .where(eq(majorExpenses.planId, planId))
    .orderBy(majorExpenses.year)
    .limit(1)
    .all();

  const yearlyExpenditure =
    overrides.yearlyExpenditure ?? firstExpense?.amountTodayValue ?? 0;

  return {
    fixedIncomeSleeve,
    marketSleeve,
    yearlyExpenditure,
    fixedIncomeROI: overrides.fixedIncomeROI ?? assumptions?.marketCagr ?? 0.07,
    inflation: overrides.inflation ?? assumptions?.inflationLongRunMean ?? 0.08,
    marketMean: overrides.marketMean ?? assumptions?.marketCagr ?? 0.12,
    marketVol: overrides.marketVol ?? assumptions?.marketVolatility ?? 0.18,
    crashFloor: overrides.crashFloor ?? DEFAULT_CRASH_FLOOR,
    trialCount: overrides.trialCount ?? assumptions?.trialCount ?? 1000,
    years: overrides.years ?? horizonYears(plan.targetRetirementDate),
    seed:
      overrides.seed !== undefined
        ? overrides.seed ?? undefined
        : assumptions?.freezeRandomSeed
          ? (assumptions.rngSeed ?? undefined)
          : undefined,
  };
}
