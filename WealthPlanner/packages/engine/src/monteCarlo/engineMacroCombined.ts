// Combined (Macro) Monte Carlo engine (docs/07 §7.2, §7.3; replicating
// `RunMacroMonteCarlo`). The most complete engine: glide-path weights,
// mean-reverting inflation, correlated Equity/Gold returns, and the data-driven
// withdrawal waterfall, per the pseudocode in docs/07 §7.3.

import type { JurisdictionPack } from "@wealthpath/jurisdictions";
import { mulberry32, type RandomSource } from "./rng/mulberry32";
import { drawBlendedReturn, type MarketParams } from "./marketReturn";
import { drawInflation, type InflationModelParams } from "../projection/inflation";
import { buildGlidePath, type GlidePathParams, type YearlyWeights } from "../projection/glidePath";
import { runWithdrawalWaterfall, type SleeveBalance } from "../projection/withdrawalWaterfall";
import { percentileSummary } from "./percentiles";

export interface MacroCombinedInput {
  liquidSleeveAtRetirement: number;
  lockedSleeveAtRetirement: number;
  baseAnnualExpense: number;
  horizonYears: number;
  startingInflation: number;
  inflationParams: InflationModelParams;
  glidePathParams: GlidePathParams;
  marketParams: MarketParams;
  /** Deterministic declared rate on the locked sleeve (jurisdiction rule). */
  lockedReturn: number;
  trialCount: number;
  seed?: number;
  pack: JurisdictionPack;
  /** Optional progress callback, invoked once per completed trial. */
  onProgress?: (completedTrials: number, totalTrials: number) => void;
}

export interface MacroCombinedResult {
  probabilityOfSuccess: number;
  curves: Array<{ year: number; P10: number; P50: number; P90: number }>;
  min: number;
  median: number;
  max: number;
}

function buildSleeves(liquid: number, locked: number): Record<string, SleeveBalance> {
  return {
    LIQUID_CASH: { balance: liquid, unlocked: true },
    FIXED_TERM_DEPOSIT: { balance: 0, unlocked: true },
    MARKET_LINKED_POOLED: { balance: 0, unlocked: true },
    GOV_SAFE_LOCKED: { balance: locked, unlocked: true },
    MARKET_LINKED_MULTI_SLEEVE: { balance: 0, unlocked: true },
  };
}

export function runMacroCombined(input: MacroCombinedInput): MacroCombinedResult {
  const rng: RandomSource =
    input.seed !== undefined ? mulberry32(input.seed) : mulberry32((Math.random() * 0xffffffff) >>> 0);
  const glideTable = buildGlidePath(input.glidePathParams, input.horizonYears);

  const results: number[][] = Array.from({ length: input.horizonYears }, () => []);

  for (let trial = 0; trial < input.trialCount; trial++) {
    let liquid = input.liquidSleeveAtRetirement;
    let locked = input.lockedSleeveAtRetirement;
    let inflation = input.startingInflation;
    let expensePrev = input.baseAnnualExpense;

    for (let y = 0; y < input.horizonYears; y++) {
      inflation = drawInflation(inflation, input.inflationParams, rng);
      const expend = y === 0 ? expensePrev : expensePrev * (1 + inflation);
      expensePrev = expend;

      const weights: YearlyWeights = glideTable[y];
      const blendReturn = drawBlendedReturn(weights, input.marketParams, rng);

      liquid *= 1 + blendReturn;
      locked *= 1 + input.lockedReturn;

      const sleeves = buildSleeves(liquid, locked);
      runWithdrawalWaterfall(expend, sleeves, input.pack);
      liquid = Math.max(0, sleeves.LIQUID_CASH.balance);
      locked = Math.max(0, sleeves.GOV_SAFE_LOCKED.balance);

      results[y].push(liquid + locked);
    }
    input.onProgress?.(trial + 1, input.trialCount);
  }

  const finalYear = results[input.horizonYears - 1];
  const summary = percentileSummary(finalYear);
  const sortedFinal = [...finalYear].sort((a, b) => a - b);

  const curves = results.map((yearValues, y) => {
    const s = percentileSummary(yearValues);
    return { year: y + 1, P10: s.P10, P50: s.P50, P90: s.P90 };
  });

  return {
    probabilityOfSuccess: finalYear.filter((c) => c > 0).length / input.trialCount,
    curves,
    min: sortedFinal[0],
    median: summary.P50,
    max: sortedFinal[sortedFinal.length - 1],
  };
}
