// Acklam inverse standard-normal CDF, ported verbatim from
// MacroMonteCarlo.bas `NormSInv` / `NormSInvRnd` (docs/15 §15.1, docs/06 §6.6).
//
// Same constants, same branch structure, same variable names where reasonable
// so a future diff against the VBA source is trivial. `NormSInvRnd` preserves
// the clamp to [0.0000001, 0.9999999] that avoids the Log(0)/Log(negative)
// singularities of the algorithm at the exact extremes.

export function normSInv(p: number): number {
  const a1 = -39.6968302866538;
  const a2 = 220.94609842452;
  const a3 = -275.928510446969;
  const a4 = 138.357751867269;
  const a5 = -30.6647980661472;
  const a6 = 2.50662827745924;

  const b1 = -54.4760987982241;
  const b2 = 161.585836858041;
  const b3 = -155.698979859887;
  const b4 = 66.8013118877197;
  const b5 = -13.2806815528857;

  const c1 = -7.78489400243029e-03;
  const c2 = -0.322396458041136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;

  const d1 = 7.78469570904146e-03;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  const pLow = 0.02425;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= 1 - pLow) {
    q = p - 0.5;
    r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

/** Clamped uniform → standard-normal draw, mirroring `NormSInvRnd`. */
export function normSInvRnd(u: number): number {
  let clamped = u;
  if (clamped <= 0) clamped = 0.0000001;
  if (clamped >= 1) clamped = 0.9999999;
  return normSInv(clamped);
}
