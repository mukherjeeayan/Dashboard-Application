// Two-sleeve retirement projection (docs/06 §6.3, source §3.3.1). Sleeve
// membership is derived from each account's `liquidity` field: LOCKED_STATUTORY
// vs. everything else. Each year: inflate expense (with a one-time lifestyle
// multiplier applied to the base before inflation), grow both sleeves, run the
// withdrawal waterfall, record the resulting total corpus.

import type { JurisdictionPack } from "@wealthpath/jurisdictions";
import {
  runWithdrawalWaterfall,
  runPooledDraw,
  computeExitTax,
  type SleeveBalance,
} from "./withdrawalWaterfall";
import { buildGlidePath, type YearlyWeights } from "./glidePath";
import { drawInflation, type InflationModelParams } from "./inflation";

export interface TwoSleeveProjectionInput {
  liquidSleeveAtRetirement: number;
  lockedSleeveAtRetirement: number;
  baseAnnualExpense: number;
  lifestyleMultiplier: number;
  inflationParams: InflationModelParams;
  startingInflation: number;
  glidePathParams: {
    startingEquityPct: number;
    equityGlideDownStepPpPerYear: number;
    equityFloorPct: number;
    goldPctHeldConstant: number;
    debtShareOfReleasedEquity: number;
  };
  /** Annual return applied to the liquid sleeve (deterministic path). */
  liquidReturn: number;
  /** Annual return applied to the locked sleeve (jurisdiction declared rate). */
  lockedReturn: number;
  horizonYears: number;
  withdrawalWaterfallEnabled: boolean;
  pack: JurisdictionPack;
  normalDraw?: () => number; // injected RNG for stochastic inflation
}

export interface TwoSleeveYearRow {
  year: number;
  expense: number;
  liquidBalance: number;
  lockedBalance: number;
  totalCorpus: number;
  weights: YearlyWeights;
}

export function projectTwoSleeve(input: TwoSleeveProjectionInput): TwoSleeveYearRow[] {
  const weightsTable = buildGlidePath(input.glidePathParams, input.horizonYears);
  const rows: TwoSleeveYearRow[] = [];

  let liquid = input.liquidSleeveAtRetirement;
  let locked = input.lockedSleeveAtRetirement;
  let inflation = input.startingInflation;

  // Base expense is scaled once by the lifestyle multiplier before inflating.
  let expense = input.baseAnnualExpense * input.lifestyleMultiplier;

  const rng: () => number =
    input.normalDraw ??
    (() => {
      throw new Error("A normalDraw source is required for stochastic inflation.");
    });

  for (let y = 0; y < input.horizonYears; y++) {
    inflation = drawInflation(inflation, input.inflationParams, rng);
    expense = y === 0 ? expense : expense * (1 + inflation);

    liquid *= 1 + input.liquidReturn;
    locked *= 1 + input.lockedReturn;

    const sleeves: Record<string, SleeveBalance> = {
      // Map sleeve balances onto the instrument types the waterfall draws from.
      LIQUID_CASH: { balance: liquid, unlocked: true },
      FIXED_TERM_DEPOSIT: { balance: 0, unlocked: true },
      MARKET_LINKED_POOLED: { balance: 0, unlocked: true },
      GOV_SAFE_LOCKED: { balance: locked, unlocked: true },
      MARKET_LINKED_MULTI_SLEEVE: { balance: 0, unlocked: true },
    };
    if (input.withdrawalWaterfallEnabled) {
      runWithdrawalWaterfall(expense, sleeves, input.pack);
    } else {
      runPooledDraw(expense, sleeves, input.pack);
    }

    // Deduct the gross draw (principal + tax) from the actual sleeve balances.
    liquid = Math.max(0, sleeves.LIQUID_CASH.balance);
    locked = Math.max(0, sleeves.GOV_SAFE_LOCKED.balance);

    rows.push({
      year: y + 1,
      expense,
      liquidBalance: liquid,
      lockedBalance: locked,
      totalCorpus: liquid + locked,
      weights: weightsTable[y],
    });
  }

  return rows;
}

export { computeExitTax };
