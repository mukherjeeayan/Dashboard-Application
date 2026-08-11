// Mean-reverting, bounded stochastic inflation process (docs/06 §6.3, source
// §3.3.3). Inflation mean-reverts toward a long-run mean with a shock each
// period, bounded to [floor, ceiling], and reversion speed accelerates when
// the current level exceeds a rate-hike threshold.

export interface InflationModelParams {
  longRunMean: number;
  meanReversionSpeed: number;
  shockVolatility: number;
  floor: number;
  ceiling: number;
  rateHikeTriggerThreshold: number;
  rateHikeExtraReversionSpeed: number;
}

export function drawInflation(
  current: number,
  params: InflationModelParams,
  normalDraw: () => number,
): number {
  const extra =
    current > params.rateHikeTriggerThreshold ? params.rateHikeExtraReversionSpeed : 0;
  const speed = params.meanReversionSpeed + extra;
  const shock = params.shockVolatility * normalDraw();
  let next = current + speed * (params.longRunMean - current) + shock;
  next = Math.max(params.floor, Math.min(params.ceiling, next));
  return next;
}
