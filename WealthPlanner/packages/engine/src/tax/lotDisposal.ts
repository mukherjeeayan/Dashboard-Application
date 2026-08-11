// Realized-gain and tax computation for lot-based holdings (docs/06 §6.9,
// docs/04 §4.8). A single disposal's gain is (pricePerUnit − costBasisPerUnit)
// × quantity; the lot source is resolved by the account's lotSelectionMethod
// (FIFO default). Where a disposal spans multiple lots, lots are consumed in
// selection order and the results summed.

import type { Lot, InstrumentType, LotSelectionMethod } from "../types";
import type { JurisdictionPack, CapitalGainsRule } from "@wealthpath/jurisdictions";
import { basisPerUnit } from "../instruments/lotBased";

export interface DisposalRequest {
  quantity: number;
  pricePerUnit: number;
  date: string;
}

export interface DisposalResult {
  gain: number;
  tax: number;
  netProceeds: number;
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * Computes capital-gains tax for a realized gain under a jurisdiction's rule.
 * Rule shapes: LONG_SHORT_SPLIT (LT/ST by holding period), FLAT_NO_HOLDING_PERIOD,
 * or SAME_AS_INCOME_TAX (fallback: taxed at the income-tax marginal rate).
 * Explicitly *not* perfectly general — see the assumption note in the docs;
 * this covers the shapes the India pack defines.
 */
export function computeGainsTax(
  gain: number,
  holdingDays: number,
  rule: CapitalGainsRule,
  pack: JurisdictionPack,
): number {
  if (rule.kind === "FLAT_NO_HOLDING_PERIOD") {
    return Math.max(0, gain) * (rule.rate ?? 0);
  }
  if (rule.kind === "SAME_AS_INCOME_TAX") {
    const rate =
      pack.incomeTax.kind === "SLAB"
        ? (pack.incomeTax.marginalRateAtRetirement ?? 0)
        : pack.incomeTax.rate;
    return Math.max(0, gain) * rate;
  }
  // Default: LONG_SHORT_SPLIT (also when kind is undefined).
  const isLongTerm = rule.longTerm != null && holdingDays >= rule.longTerm.holdingPeriodDays;
  if (isLongTerm && rule.longTerm) {
    const exemption = rule.longTerm.annualExemption ?? 0;
    const taxable = Math.max(0, gain - exemption);
    return taxable * rule.longTerm.rate;
  }
  const shortRate = pack.incomeTax.kind === "SLAB" ? (pack.incomeTax.marginalRateAtRetirement ?? 0) : 0;
  return Math.max(0, gain) * shortRate;
}

function orderLots(lots: Lot[], method: LotSelectionMethod | undefined): Lot[] {
  // FIFO: oldest acquisition first; LIFO: newest first.
  const sorted = [...lots].sort(
    (a, b) => new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime(),
  );
  return method === "LIFO" ? sorted.reverse() : sorted;
}

/**
 * Computes realized gain/tax for a disposal drawn across lots in selection
 * order, partially consuming each lot until the requested quantity is met.
 */
export function disposeAcrossLots(
  request: DisposalRequest,
  lots: Lot[],
  instrumentType: InstrumentType,
  pack: JurisdictionPack,
  method: LotSelectionMethod = "FIFO",
): DisposalResult {
  const rule = pack.capitalGains?.[instrumentType] as CapitalGainsRule | undefined;
  if (!rule) {
    throw new Error(`No capitalGains rule defined for instrument type "${instrumentType}".`);
  }

  let remaining = request.quantity;
  let totalGain = 0;
  let totalTax = 0;

  for (const lot of orderLots(lots, method)) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.quantity);
    const cost = basisPerUnit(lot) * take;
    const proceeds = request.pricePerUnit * take;
    const gain = proceeds - cost;
    const holdingDays = daysBetween(lot.acquisitionDate, request.date);
    const tax = computeGainsTax(gain, holdingDays, rule, pack);
    totalGain += gain;
    totalTax += tax;
    remaining -= take;
  }

  if (remaining > 1e-9) {
    throw new Error("Disposal quantity exceeds total available lot quantity.");
  }

  return { gain: totalGain, tax: totalTax, netProceeds: totalGain - totalTax };
}
