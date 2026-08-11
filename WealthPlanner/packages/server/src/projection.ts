// Deterministic two-sleeve projection endpoint logic (docs/06 §6.3, source
// §3.3.1). Maps stored accounts + assumptions into the engine's pure
// `projectTwoSleeve` and returns the year-by-year table (locked vs liquid
// sleeve, inflation-adjusted expense, glide-path weights). Uses the
// mean-reversion inflation path with zero shock (a deterministic "mean" run).

import { eq } from "drizzle-orm";
import {
  projectTwoSleeve,
  type TwoSleeveYearRow,
} from "@wealthpath/engine";
import { loadPack } from "@wealthpath/jurisdictions";
import type { Db } from "./db";
import { accounts, majorExpenses, planAssumptions, plans } from "./db/schema";

export interface ProjectionResult {
  planId: string;
  years: number;
  rows: TwoSleeveYearRow[];
}

/** A locked (statutory) account is one whose liquidity mentions "locked". */
function isLocked(liquidity: string): boolean {
  return /locked/i.test(liquidity);
}

function horizonYears(targetRetirementDate: string, asOf = new Date()): number {
  const target = new Date(targetRetirementDate).getUTCFullYear();
  const now = asOf.getUTCFullYear();
  return Math.max(1, target - now);
}

/**
 * Projects a plan deterministically, or returns null when the plan does not
 * exist. `liquidReturn` defaults to the market CAGR; `lockedReturn` to the
 * fixed-income ROI; both overridable.
 */
export function projectPlan(
  db: Db,
  planId: string,
  overrides: { liquidReturn?: number; lockedReturn?: number } = {},
): ProjectionResult | null {
  const ctx = buildProjectionContext(db, planId, overrides);
  if (!ctx) return null;
  const rows = projectTwoSleeve({
    ...ctx.base,
    withdrawalWaterfallEnabled: ctx.waterfallEnabled,
  });
  return { planId, years: ctx.base.horizonYears, rows };
}

type TwoSleeveBaseInput = Omit<Parameters<typeof projectTwoSleeve>[0], "withdrawalWaterfallEnabled">;

interface ProjectionContext {
  base: TwoSleeveBaseInput;
  waterfallEnabled: boolean;
}

/** Builds the shared two-sleeve input for a plan (minus the waterfall toggle). */
function buildProjectionContext(
  db: Db,
  planId: string,
  overrides: { liquidReturn?: number; lockedReturn?: number } = {},
): ProjectionContext | null {
  const [plan] = db.select().from(plans).where(eq(plans.id, planId)).limit(1).all();
  if (!plan) return null;

  const [assumptions] = db
    .select()
    .from(planAssumptions)
    .where(eq(planAssumptions.planId, planId))
    .limit(1)
    .all();

  const planAccounts = db.select().from(accounts).where(eq(accounts.planId, planId)).all();

  let liquidSleeveAtRetirement = 0;
  let lockedSleeveAtRetirement = 0;
  for (const account of planAccounts) {
    const balance = account.currentBalance ?? 0;
    if (isLocked(account.liquidity)) lockedSleeveAtRetirement += balance;
    else liquidSleeveAtRetirement += balance;
  }

  const pack = loadPack(plan.jurisdictionPackId);
  const years = horizonYears(plan.targetRetirementDate);
  const marketCagr = assumptions?.marketCagr ?? 0.12;
  const fixedIncomeROI = overrides.lockedReturn ?? 0.07;

  // Annual spend to draw from the corpus: the plan's first major expense.
  const [firstExpense] = db
    .select()
    .from(majorExpenses)
    .where(eq(majorExpenses.planId, planId))
    .orderBy(majorExpenses.year)
    .limit(1)
    .all();
  const baseAnnualExpense = firstExpense?.amountTodayValue ?? 0;

  return {
    base: {
      liquidSleeveAtRetirement,
      lockedSleeveAtRetirement,
      baseAnnualExpense,
      lifestyleMultiplier: 1,
      inflationParams: {
        longRunMean: assumptions?.inflationLongRunMean ?? 0.075,
        meanReversionSpeed: assumptions?.inflationMeanReversionSpeed ?? 0.2,
        shockVolatility: assumptions?.inflationShockVolatility ?? 0,
        floor: assumptions?.inflationFloor ?? 0,
        ceiling: assumptions?.inflationCeiling ?? 0.15,
        // Rate-hike branch disabled deterministically (current never exceeds 1).
        rateHikeTriggerThreshold: 1,
        rateHikeExtraReversionSpeed: 0,
      },
      startingInflation: assumptions?.inflationLongRunMean ?? 0.075,
      glidePathParams: {
        startingEquityPct: assumptions?.glideStartEquity ?? 0.7,
        equityGlideDownStepPpPerYear: assumptions?.glideStep ?? 0.02,
        equityFloorPct: assumptions?.glideFloor ?? 0.3,
        goldPctHeldConstant: 0.1,
        debtShareOfReleasedEquity: 0.85,
      },
      liquidReturn: overrides.liquidReturn ?? marketCagr,
      lockedReturn: fixedIncomeROI,
      horizonYears: years,
      pack,
      normalDraw: () => 0,
    },
    waterfallEnabled: assumptions?.withdrawalWaterfallEnabled ?? true,
  };
}

export interface WithdrawalStrategyResult {
  planId: string;
  years: number;
  waterfallEnabled: boolean;
  /** Deterministic projection with the jurisdiction's withdrawal waterfall. */
  waterfall: TwoSleeveYearRow[];
  /** Deterministic projection using a simple pooled draw (no ordering rules). */
  pooled: TwoSleeveYearRow[];
  /** Ending-corpus difference (waterfall - pooled), in currency units. */
  endingDifference: number;
}

/**
 * Builds the pure two-sleeve input for a plan (or null when the plan is
 * missing). Exposed so the sensitivity / scenario endpoints can drive the
 * engine with the same deterministic inputs as the projection route.
 */
export function buildPlanTwoSleeveInput(
  db: Db,
  planId: string,
): Parameters<typeof projectTwoSleeve>[0] | null {
  const ctx = buildProjectionContext(db, planId);
  if (!ctx) return null;
  return { ...ctx.base, withdrawalWaterfallEnabled: ctx.waterfallEnabled };
}

/** Runs the projection twice — waterfall vs pooled draw — for comparison. */
export function projectWithdrawalStrategies(db: Db, planId: string): WithdrawalStrategyResult | null {
  const ctx = buildProjectionContext(db, planId);
  if (!ctx) return null;

  const waterfall = projectTwoSleeve({ ...ctx.base, withdrawalWaterfallEnabled: true });
  const pooled = projectTwoSleeve({ ...ctx.base, withdrawalWaterfallEnabled: false });

  const last = ctx.base.horizonYears - 1;
  return {
    planId,
    years: ctx.base.horizonYears,
    waterfallEnabled: ctx.waterfallEnabled,
    waterfall,
    pooled,
    endingDifference: waterfall[last].totalCorpus - pooled[last].totalCorpus,
  };
}
