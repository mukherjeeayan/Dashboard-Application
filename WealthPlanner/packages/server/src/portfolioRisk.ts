// Portfolio Risk dashboard projection (docs/06 §6.5, source §3.7). Maps each
// account into one of the four risk buckets (Equity/Gold/Debt/Cash) and runs
// the engine's Markowitz variance + HHI + rebalancing computation. The
// variance-covariance matrix and per-account bucket mapping are fixed
// asset-class/type defaults here (mirroring the "unchanged expansion" from the
// source doc); the user-editable target allocation is read from the plan's
// assumptions (`targetAllocationJson`) and defaults to the current allocation
// when absent, so the panel still renders meaningful metrics before a target
// is set.

import { eq } from "drizzle-orm";
import { allocationRisk } from "@wealthpath/engine";
import type { Db } from "./db";
import { accounts, planAssumptions, plans } from "./db/schema";

/** The four Markowitz risk buckets (source §3.7). */
export const RISK_BUCKETS = ["EQUITY", "GOLD", "DEBT", "CASH"] as const;
export type RiskBucket = (typeof RISK_BUCKETS)[number];

export const BUCKET_LABELS: Record<RiskBucket, string> = {
  EQUITY: "Equity",
  GOLD: "Gold & alternatives",
  DEBT: "Debt",
  CASH: "Cash",
};

/** Default instrument-type → risk-bucket mapping (debt-like and cash first). */
const INSTRUMENT_BUCKET: Record<string, RiskBucket> = {
  MARKET_LINKED_POOLED: "EQUITY",
  MARKET_LINKED_MULTI_SLEEVE: "EQUITY",
  MARKET_LINKED_DIRECT: "EQUITY",
  DIGITAL_ASSET: "GOLD",
  GOV_SAFE_LOCKED: "DEBT",
  EMPLOYER_MANDATORY_LOCKED: "DEBT",
  EMPLOYER_DISCRETIONARY_LOCKED: "DEBT",
  FIXED_TERM_DEPOSIT: "DEBT",
  LIQUID_CASH: "CASH",
};

/** Annualized standard deviation per bucket. */
const SIGMA: Record<RiskBucket, number> = {
  EQUITY: 0.18,
  GOLD: 0.15,
  DEBT: 0.06,
  CASH: 0.01,
};

/** Correlations between buckets (symmetric, diagonal implicitly 1). */
const CORR: Record<string, number> = {
  EQUITY_GOLD: 0.15,
  EQUITY_DEBT: 0.1,
  EQUITY_CASH: 0,
  GOLD_DEBT: 0,
  GOLD_CASH: 0,
  DEBT_CASH: 0,
};

function covariance(a: RiskBucket, b: RiskBucket): number {
  if (a === b) return SIGMA[a] * SIGMA[a];
  const key = `${a}_${b}`;
  const r = CORR[key] ?? CORR[`${b}_${a}`] ?? 0;
  return r * SIGMA[a] * SIGMA[b];
}

/** Builds the full variance-covariance matrix in the engine's "A_B" keying. */
export function buildCovariances(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of RISK_BUCKETS) {
    for (const b of RISK_BUCKETS) {
      if (a <= b) out[`${a}_${b}`] = covariance(a, b);
    }
  }
  return out;
}

export interface PortfolioRiskInput {
  planId: string;
  /** Optional explicit target weights; if absent, target = current allocation. */
  targetWeights?: Partial<Record<RiskBucket, number>>;
}

export interface PortfolioRiskResult {
  planId: string;
  totalValue: number;
  variance: number;
  volatility: number;
  hhi: number;
  buckets: Array<{
    bucket: RiskBucket;
    label: string;
    currentValue: number;
    currentWeight: number;
    targetWeight: number;
    rebalance: number;
  }>;
  hasTarget: boolean;
}

/** Single-bucket default split (100% to the instrument's primary bucket). */
function defaultSplit(instrumentType: string): Record<RiskBucket, number> {
  const bucket = INSTRUMENT_BUCKET[instrumentType] ?? "EQUITY";
  const out: Record<RiskBucket, number> = { EQUITY: 0, GOLD: 0, DEBT: 0, CASH: 0 };
  out[bucket] = 1;
  return out;
}

/** Parses + normalises a stored per-account split JSON; null when absent/invalid. */
function parseSplit(json: string | null | undefined): Record<RiskBucket, number> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Record<string, number>;
    const normalised = normalise(parsed);
    if (!normalised) return null;
    return { EQUITY: 0, GOLD: 0, DEBT: 0, CASH: 0, ...normalised };
  } catch {
    return null;
  }
}

/** Normalises weights to sum to 1; returns null when no positive sum exists. */
function normalise(weights: Record<string, number> | undefined): Record<string, number> | null {
  if (!weights) return null;
  const sum = Object.values(weights).reduce((s, v) => s + Math.max(0, v), 0);
  if (sum <= 0) return null;
  const out: Record<string, number> = {};
  for (const b of RISK_BUCKETS) out[b] = Math.max(0, weights[b] ?? 0) / sum;
  return out;
}

/**
 * Computes the Portfolio Risk metrics for a plan, or returns null when the
 * plan does not exist. Current weights are derived from account balances via
 * the instrument→bucket mapping; target weights come from assumptions or the
 * provided override.
 */
export function projectPortfolioRisk(
  db: Db,
  input: PortfolioRiskInput,
): PortfolioRiskResult | null {
  const [plan] = db
    .select()
    .from(plans)
    .where(eq(plans.id, input.planId))
    .limit(1)
    .all();
  if (!plan) return null;

  const [assumptions] = db
    .select()
    .from(planAssumptions)
    .where(eq(planAssumptions.planId, input.planId))
    .limit(1)
    .all();

  const planAccounts = db
    .select()
    .from(accounts)
    .where(eq(accounts.planId, input.planId))
    .all();

  const current: Record<RiskBucket, number> = { EQUITY: 0, GOLD: 0, DEBT: 0, CASH: 0 };
  let total = 0;
  for (const account of planAccounts) {
    const balance = account.currentBalance ?? 0;
    const split = parseSplit(account.bucketSplitJson) ?? defaultSplit(account.instrumentType);
    for (const bucket of RISK_BUCKETS) current[bucket] += balance * split[bucket];
    total += balance;
  }

  const weights = total > 0 ? normalise(current) : null;
  const weightRecord = weights ?? { EQUITY: 0, GOLD: 0, DEBT: 0, CASH: 0 };

  // Target (weights): explicit override > assumptions JSON > current allocation.
  let targetWeights: Record<string, number> | null = null;
  if (input.targetWeights) {
    targetWeights = normalise(input.targetWeights as Record<string, number>);
  } else if (assumptions?.targetAllocationJson) {
    try {
      const parsed = JSON.parse(assumptions.targetAllocationJson) as Record<string, number>;
      targetWeights = normalise(parsed);
    } catch {
      targetWeights = null;
    }
  }
  const hasTarget = !!targetWeights;
  const target = targetWeights ?? weightRecord;

  // Engine expects `current` as money values and `target` as weights; it derives
  // weights (current/total) and rebalancing (targetValue - currentValue) itself.
  const engine = allocationRisk({
    target,
    current,
    covariances: buildCovariances(),
  });

  return {
    planId: input.planId,
    totalValue: total,
    variance: engine.variance,
    volatility: engine.volatility,
    hhi: engine.hhi,
    hasTarget,
    buckets: RISK_BUCKETS.map((bucket) => {
      const rebalanceRow = engine.rebalance.find((r) => r.bucket === bucket);
      return {
        bucket,
        label: BUCKET_LABELS[bucket],
        currentValue: current[bucket],
        currentWeight: weightRecord[bucket],
        targetWeight: target[bucket],
        rebalance: rebalanceRow?.amount ?? 0,
      };
    }),
  };
}
