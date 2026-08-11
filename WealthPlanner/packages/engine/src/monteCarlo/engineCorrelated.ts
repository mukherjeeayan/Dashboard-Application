// Correlated Monte Carlo engine (docs/07 §7.2, source §3.9; replicating
// `RunCorrelatedMonteCarlo_Macro`). Extends the single-blended structure with
// the market sleeve split into Equity and Gold, whose returns are correlated
// via a Cholesky-style pair construction (§3.9, docs/06 §6.3).

import { mulberry32, type RandomSource } from "./rng/mulberry32";
import { meanPreservingLognormal, drawCorrelatedNormals } from "./marketReturn";
import { percentileSummary } from "./percentiles";

export interface CorrelatedInput {
  fixedIncomeSleeve: number;
  equitySleeve: number;
  goldSleeve: number;
  yearlyExpenditure: number;
  fixedIncomeROI: number;
  inflation: number;
  equityMean: number;
  equityVol: number;
  goldMean: number;
  goldVol: number;
  equityGoldCorrelation: number;
  crashFloor: number;
  trialCount: number;
  years: number;
  seed?: number;
  /** Optional progress callback, invoked once per completed trial. */
  onProgress?: (completedTrials: number, totalTrials: number) => void;
}

export interface CorrelatedResult {
  probabilityOfSuccess: number;
  curves: Array<{ year: number; P10: number; P50: number; P90: number }>;
  min: number;
  median: number;
  max: number;
}

export function runCorrelated(input: CorrelatedInput): CorrelatedResult {
  const rng: RandomSource =
    input.seed !== undefined ? mulberry32(input.seed) : mulberry32((Math.random() * 0xffffffff) >>> 0);

  const results: number[][] = Array.from({ length: input.years }, () => []);

  for (let trial = 0; trial < input.trialCount; trial++) {
    let fixed = input.fixedIncomeSleeve;
    let equity = input.equitySleeve;
    let gold = input.goldSleeve;
    let expense = input.yearlyExpenditure;

    for (let y = 0; y < input.years; y++) {
      const { z1, z2 } = drawCorrelatedNormals(rng, input.equityGoldCorrelation);
      let equityRet = meanPreservingLognormal(z1, input.equityMean, input.equityVol);
      let goldRet = meanPreservingLognormal(z2, input.goldMean, input.goldVol);
      if (equityRet < input.crashFloor) equityRet = input.crashFloor;
      if (goldRet < input.crashFloor) goldRet = input.crashFloor;

      fixed *= 1 + input.fixedIncomeROI;
      equity *= 1 + equityRet;
      gold *= 1 + goldRet;
      if (y > 0) expense *= 1 + input.inflation;

      // Withdraw from the total, preserving each sleeve's weight so a bad
      // sequence compounds the drawdown (as in engineSingleBlended).
      const total = fixed + equity + gold;
      const wFixed = total !== 0 ? fixed / total : 1 / 3;
      const wEquity = total !== 0 ? equity / total : 1 / 3;
      const after = total - expense;
      fixed = after * wFixed;
      equity = after * wEquity;
      gold = after * (1 - wFixed - wEquity);

      results[y].push(after);
    }
    input.onProgress?.(trial + 1, input.trialCount);
  }

  const finalYear = results[input.years - 1];
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
