// Accumulation Monte Carlo engine (docs/07 §7.2, source §4.5; replicating
// `RunAccumulationMonteCarlo_Macro`). Models the pre-retirement build-up of a
// market-linked (MF-equivalent) corpus via stochastic returns plus annual
// contributions, and solves the "extra working years needed at P10" — the
// number of years beyond the planned horizon by which at least 90% of paths
// reach the retirement-corpus target.

import { mulberry32, type RandomSource } from "./rng/mulberry32";
import { drawMarketReturn } from "./marketReturn";
import { percentiles } from "./percentiles";

export interface AccumulationInput {
  currentCorpus: number;
  annualContribution: number;
  /** Annual return on the MF-equivalent sleeve. */
  marketMean: number;
  marketVol: number;
  /** Target retirement corpus. */
  targetCorpus: number;
  /** Planned working years (base horizon). */
  baseYears: number;
  /** Hard cap on years scanned when a path never reaches the target. */
  maxYears: number;
  crashFloor: number;
  trialCount: number;
  seed?: number;
  /** Optional progress callback, invoked once per completed trial. */
  onProgress?: (completedTrials: number, totalTrials: number) => void;
}

export interface AccumulationResult {
  /** % of paths that reach the target within `baseYears`. */
  probabilityOfSuccessByBaseHorizon: number;
  /** Corpus percentile curve at the base horizon. */
  corpusAtBase: { P10: number; P50: number; P90: number };
  /** Extra years beyond `baseYears` by which 90% of paths reach the target. */
  extraYearsNeededAtP10: number;
  /** P10/P50/P90 of the years-to-target across all paths (≤ maxYears). */
  yearsToTargetPercentiles: { P10: number; P50: number; P90: number };
}

export function runAccumulation(input: AccumulationInput): AccumulationResult {
  const rng: RandomSource =
    input.seed !== undefined ? mulberry32(input.seed) : mulberry32((Math.random() * 0xffffffff) >>> 0);

  // Corpus at the base horizon for every trial.
  const corpusAtBase: number[] = [];
  // Years each trial needs to reach the target (capped at maxYears).
  const yearsToTarget: number[] = [];

  for (let trial = 0; trial < input.trialCount; trial++) {
    let corpus = input.currentCorpus;
    let reachedYear = -1;

    for (let y = 0; y < input.maxYears; y++) {
      const ret = drawMarketReturn(rng, input.marketMean, input.marketVol, input.crashFloor);
      corpus = corpus * (1 + ret) + input.annualContribution;

      if (reachedYear < 0 && corpus >= input.targetCorpus) reachedYear = y + 1;
      if (y === input.baseYears - 1) corpusAtBase.push(corpus);
    }
    yearsToTarget.push(reachedYear < 0 ? input.maxYears : reachedYear);
    input.onProgress?.(trial + 1, input.trialCount);
  }

  const [p10, p50, p90] = percentiles(corpusAtBase, [10, 50, 90]);
  const [y10, y50, y90] = percentiles(yearsToTarget, [10, 50, 90]);

  return {
    probabilityOfSuccessByBaseHorizon: yearsToTarget.filter((yt) => yt <= input.baseYears).length / input.trialCount,
    corpusAtBase: { P10: p10, P50: p50, P90: p90 },
    // 90% of paths reach the target within `y90` years; the extra beyond the
    // planned horizon is the buffer a plan owner should hold for downside risk.
    extraYearsNeededAtP10: Math.max(0, y90 - input.baseYears),
    yearsToTargetPercentiles: { P10: y10, P50: y50, P90: y90 },
  };
}
