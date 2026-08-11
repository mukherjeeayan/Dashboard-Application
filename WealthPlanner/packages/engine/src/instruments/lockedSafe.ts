// GOV_SAFE_LOCKED: flat/declared-rate compounding, statutory contribution cap
// (e.g. PPF). Replaces the hardcoded ₹1,50,000 cap — the cap is read from the
// active Jurisdiction Pack (docs/06 §6.1 CAPPED_STATUTORY).

import { projectFlat } from "./compounding";

export interface LockedSafeConfig {
  declaredRate: number;
  /** Annual contribution cap (null = uncapped). */
  annualCap: number | null;
}

/**
 * Resolves the capped annual contribution: fixed periodic amount, clamped to
 * the statutory cap when the account has already reached it in the year.
 */
export function resolveCappedContribution(amount: number, annualCap: number | null): number {
  if (annualCap === null) return amount;
  return Math.min(amount, annualCap);
}

export interface LockedSafeProjection {
  openingBalance: number;
  contribution: number;
  rate: number;
  years: number;
}

/** Projection for a flat, declared-rate locked-safety account (PPF-equivalent). */
export function projectLockedSafe(p: LockedSafeProjection): number[] {
  return projectFlat({
    openingBalance: p.openingBalance,
    roi: p.rate,
    annualContribution: p.contribution,
    years: p.years,
  });
}
