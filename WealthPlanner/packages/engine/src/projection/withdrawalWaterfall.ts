// Data-driven withdrawal waterfall (docs/05 §5.4, source §3.3.4).
// The draw ORDER is jurisdiction data (pack.withdrawalWaterfall.order), not
// hardcoded. Whether the waterfall runs at all is a Plan Assumption
// (PlanAssumptions.withdrawalWaterfallEnabled); when disabled the caller uses a
// simple pooled draw instead.

import type { JurisdictionPack, InstrumentRule } from "@wealthpath/jurisdictions";
import type { InstrumentType } from "../types";

export interface SleeveBalance {
  balance: number;
  unlocked: boolean;
}

export interface Draw {
  instrumentType: InstrumentType;
  draw: number;
  tax: number;
  net: number;
}

export interface WaterfallResult {
  draws: Draw[];
  unmetNeed: number;
}

/** Sleeves keyed by InstrumentType; a `string` key type lets a pack's order
 *  drive the lookup without requiring all nine types to be present. */
export type SleeveMap = Record<string, SleeveBalance>;

/**
 * Computes the tax on a retirement drawdown for a given instrument type.
 * Dispatches on the jurisdiction's taxTreatment for that type's rule; falls
 * back to the capital-gains rule for CAPITAL_GAINS treatment, and 0 (EXEMPT)
 * otherwise. This is a deliberate simplification of a genuinely
 * jurisdiction-dependent calculation — it covers the India pack's shapes and
 * is unit-tested against them.
 */
export function computeExitTax(
  draw: number,
  instrumentType: InstrumentType,
  pack: JurisdictionPack,
): number {
  const rule = findRuleForType(pack, instrumentType);
  const treatment = rule?.taxTreatment;

  // Explicit EXEMPT on exit.
  const exitTreatment = treatment?.onExit;
  if (exitTreatment === "EXEMPT") return 0;

  // Growth already taxed as it accrues (e.g. FD / savings-account interest,
  // `onGrowth: SLAB_RATE_ANNUAL_ACCRUAL` in the India pack). The withdrawal is
  // a return of the already-taxed corpus (principal + post-tax interest), so
  // no further tax on exit — avoids double taxation (docs/05 §5.4).
  if (treatment?.onGrowth === "SLAB_RATE_ANNUAL_ACCRUAL") return 0;

  const onGrowth = treatment?.onGrowth;
  if (onGrowth === "DEFERRED" || onGrowth === "EXEMPT") {
    // Growth deferred/exempt — tax only if exit says so.
  }

  const capRule = pack.capitalGains?.[instrumentType];
  if (capRule && typeof capRule === "object" && "longTerm" in capRule && capRule.longTerm) {
    // Long-term capital gains with annual exemption (retirement drawdown is
    // held long-term).
    const taxable = Math.max(0, draw - (capRule.longTerm.annualExemption ?? 0));
    return taxable * capRule.longTerm.rate;
  }
  if (capRule && typeof capRule === "object" && capRule.kind === "FLAT_NO_HOLDING_PERIOD") {
    return Math.max(0, draw) * (capRule.rate ?? 0);
  }

  // SLAB_RATE / annuity income: tax at the retirement marginal rate.
  if (pack.incomeTax.kind === "SLAB") {
    return Math.max(0, draw) * (pack.incomeTax.marginalRateAtRetirement ?? 0);
  }
  return Math.max(0, draw) * pack.incomeTax.rate;
}

function findRuleForType(pack: JurisdictionPack, instrumentType: InstrumentType): InstrumentRule | undefined {
  return Object.values(pack.instrumentRules).find((r) => r.instrumentType === instrumentType);
}

/**
 * Runs the waterfall, drawing from sleeves in the pack's order until the need
 * is met or all unlocked sleeves are exhausted. Tax is computed per draw and
 * reduces the net amount available, so `remaining` is reduced by net (draw−tax).
 */
export function runWithdrawalWaterfall(
  need: number,
  sleeves: SleeveMap,
  pack: JurisdictionPack,
): WaterfallResult {
  const order = pack.withdrawalWaterfall.order;
  let remaining = need;
  const draws: Draw[] = [];

  for (const instrumentType of order) {
    if (remaining <= 0) break;
    const sleeve = sleeves[instrumentType];
    if (!sleeve || !sleeve.unlocked || sleeve.balance <= 0) continue;

    const draw = Math.min(remaining, sleeve.balance);
    const tax = computeExitTax(draw, instrumentType, pack);
    const net = draw - tax;
    draws.push({ instrumentType, draw, tax, net });
    remaining -= net;
    sleeve.balance -= draw;
  }

  return { draws, unmetNeed: Math.max(0, remaining) };
}

/**
 * Simple pooled draw across all unlocked sleeves (used when the waterfall is
 * disabled): each sleeve contributes proportionally to its unlocked balance.
 */
export function runPooledDraw(
  need: number,
  sleeves: SleeveMap,
  pack: JurisdictionPack,
): WaterfallResult {
  const order = pack.withdrawalWaterfall.order;
  const total = order.reduce((s, t) => s + (sleeves[t]?.unlocked ? sleeves[t].balance : 0), 0);
  const draws: Draw[] = [];
  let remaining = need;

  for (const instrumentType of order) {
    if (remaining <= 0) break;
    const sleeve = sleeves[instrumentType];
    if (!sleeve || !sleeve.unlocked || sleeve.balance <= 0) continue;
    const share = total > 0 ? (sleeve.balance / total) * need : 0;
    const draw = Math.min(share, sleeve.balance);
    const tax = computeExitTax(draw, instrumentType, pack);
    const net = draw - tax;
    draws.push({ instrumentType, draw, tax, net });
    remaining -= net;
    sleeve.balance -= draw;
  }

  return { draws, unmetNeed: Math.max(0, remaining) };
}
