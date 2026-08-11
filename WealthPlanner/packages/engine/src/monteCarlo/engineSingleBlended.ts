// Single-blended-CAGR Monte Carlo engine (docs/07 §7.2, source §3.8;
// replicating `RunMonteCarloSimulation_Macro`). Worked example + inputs/outputs
// in docs/15 §15.3.3.
//
// A fixed-income sleeve grows deterministically; the market sleeve grows at a
// log-normal CAGR draw each year (clamped by the single-year crash floor);
// yearly expenditure grows at a (deterministic) inflation rate and is drawn
// from the combined corpus. Each module is a pure function used unmodified by
// both the worker and the test suite (docs/07 §7.2).

import { mulberry32, type RandomSource } from "./rng/mulberry32";
import { drawMarketReturn } from "./marketReturn";
import { percentileSummary } from "./percentiles";

export interface SingleBlendedInput {
  fixedIncomeSleeve: number;
  marketSleeve: number;
  yearlyExpenditure: number;
  /** Deterministic annual ROI on the fixed-income sleeve. */
  fixedIncomeROI: number;
  /** Deterministic annual inflation rate applied to expenditure. */
  inflation: number;
  /** Market CAGR mean (μ) and volatility (σ) for the log-normal draw. */
  marketMean: number;
  marketVol: number;
  /** Lower bound on a single-year market return (crash floor). */
  crashFloor: number;
  trialCount: number;
  years: number;
  /** Optional fixed seed for reproducible runs ("Freeze Random Seed"). */
  seed?: number;
  /** Optional progress callback, invoked once per completed trial. */
  onProgress?: (completedTrials: number, totalTrials: number) => void;
}

export interface SingleBlendedResult {
  /** % of trials whose corpus is still positive at the horizon. */
  probabilityOfSuccess: number;
  /** One percentile summary per simulated year (fan-chart data). */
  curves: Array<{ year: number; P10: number; P50: number; P90: number }>;
  min: number;
  median: number;
  max: number;
}

export function runSingleBlended(input: SingleBlendedInput): SingleBlendedResult {
  const rng: RandomSource =
    input.seed !== undefined ? mulberry32(input.seed) : mulberry32((Math.random() * 0xffffffff) >>> 0);

  // results[y][trial] = corpus at end of year y for trial t.
  const results: number[][] = Array.from({ length: input.years }, () => []);

  for (let trial = 0; trial < input.trialCount; trial++) {
    let fixed = input.fixedIncomeSleeve;
    let market = input.marketSleeve;
    let expense = input.yearlyExpenditure;

    for (let y = 0; y < input.years; y++) {
      const marketRet = drawMarketReturn(rng, input.marketMean, input.marketVol, input.crashFloor);
      fixed *= 1 + input.fixedIncomeROI;
      market *= 1 + marketRet;
      if (y > 0) expense *= 1 + input.inflation;

      // Draw the annual expense from the corpus, preserving the sleeve weight
      // so a poor market sequence compounds the drawdown (a loss reduces the
      // base the next year's return acts on). A shortfall is allowed to carry
      // negative — matching the workbook's deeply negative worst-case — and
      // such trials count as failures (final corpus <= 0).
      const total = fixed + market;
      const fixedWeight = total !== 0 ? fixed / total : 0.5;
      const after = total - expense;
      fixed = after * fixedWeight;
      market = after * (1 - fixedWeight);

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
