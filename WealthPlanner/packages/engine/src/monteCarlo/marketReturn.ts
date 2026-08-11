// Shared market-return draws for the Monte Carlo engines (docs/06 §6.3,
// §6.6; docs/07 §7.2). All engines use the same mean-preserving log-normal
// convention so their percentile scales are comparable and consistent with the
// validated engineSingleBlended (docs/15 §15.3.3).

import type { RandomSource } from "./rng/mulberry32";
import { normSInvRnd } from "./rng/acklamInverseNormal";

/** Mean-preserving log-normal: E[1 + r] = 1 + μ, i.e. ln(1+r) ~ N(ln(1+μ) − σ²/2, σ²). */
export function meanPreservingLognormal(z: number, mean: number, vol: number): number {
  const logMean = Math.log(1 + mean) - (vol * vol) / 2;
  return Math.exp(logMean + vol * z) - 1;
}

/** Draws a single-asset market return, floored by the crash floor. */
export function drawMarketReturn(rng: RandomSource, mean: number, vol: number, crashFloor: number): number {
  const z = normSInvRnd(rng());
  const ret = meanPreservingLognormal(z, mean, vol);
  return ret < crashFloor ? crashFloor : ret;
}

/** Returns two correlated standard-normal draws via Cholesky decomposition. */
export function drawCorrelatedNormals(
  rng: RandomSource,
  correlation: number,
): { z1: number; z2: number } {
  const z1 = normSInvRnd(rng());
  const zIndependent = normSInvRnd(rng());
  const z2 = correlation * z1 + Math.sqrt(1 - correlation * correlation) * zIndependent;
  return { z1, z2 };
}

export interface MarketParams {
  equityMean: number;
  equityVol: number;
  goldMean: number;
  goldVol: number;
  equityGoldCorrelation: number;
  debtRate: number;
  cashRate: number;
  crashFloor: number;
}

/** Draws a blended Equity/Gold/Debt/Cash return from glide weights, with the
 *  equity/gold pair correlated via Cholesky (docs/07 §7.2, §7.3). */
export function drawBlendedReturn(
  weights: { EQUITY: number; GOLD: number; DEBT: number; CASH: number },
  params: MarketParams,
  rng: RandomSource,
): number {
  const { z1, z2 } = drawCorrelatedNormals(rng, params.equityGoldCorrelation);
  const equity = meanPreservingLognormal(z1, params.equityMean, params.equityVol);
  const gold = meanPreservingLognormal(z2, params.goldMean, params.goldVol);
  const blended =
    weights.EQUITY * equity + weights.GOLD * gold + weights.DEBT * params.debtRate + weights.CASH * params.cashRate;
  return blended < params.crashFloor ? params.crashFloor : blended;
}
