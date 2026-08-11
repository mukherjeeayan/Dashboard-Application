// DISCRETE_LOTS (MARKET_LINKED_DIRECT, DIGITAL_ASSET): current-value
// computation. Unlike POOLED_BALANCE accounts these are NOT part of the
// recursive compounding formula — value is Σ lot.remainingQuantity × latest
// manually-entered price per ticker (docs/04 §4.3.1, docs/06 §6.1).

import type { Lot, LotDisposal, CostBasisAdjustment } from "../types";

/** A lot with its disposals folded in (remaining quantity + cost basis). */
export interface AdjustedLot {
  id: string;
  ticker: string;
  remainingQuantity: number;
  costBasisPerUnit: number;
  acquisitionDate: string;
  disposals: LotDisposal[];
}

function adjustedCostBasis(lot: Lot): number {
  let costPerUnit = lot.acquisitionPricePerUnit;
  for (const adj of lot.costBasisAdjustments ?? []) {
    if (adj.quantityMultiplier) {
      // A split divides cost-per-unit; total basis unchanged.
      costPerUnit /= adj.quantityMultiplier;
    }
  }
  return costPerUnit;
}

function disposedQuantity(lot: Lot): number {
  return (lot.disposals ?? []).reduce((s, d) => s + d.quantity, 0);
}

/** Returns the remaining, un-disposed quantity of a lot (cannot go negative). */
export function remainingQuantity(lot: Lot): number {
  return Math.max(0, lot.quantity - disposedQuantity(lot));
}

export function toAdjustedLot(lot: Lot): AdjustedLot {
  return {
    id: lot.id,
    ticker: lot.ticker,
    remainingQuantity: remainingQuantity(lot),
    costBasisPerUnit: adjustedCostBasis(lot),
    acquisitionDate: lot.acquisitionDate,
    disposals: lot.disposals ?? [],
  };
}

/**
 * Current unrealized value of an account's lots, using the latest manually
 * entered price per ticker (docs/04 §4.3.1). Unknown tickers contribute 0.
 */
export function currentLotValue(
  lots: Lot[],
  latestPrices: Record<string, number>,
): number {
  return lots.reduce((sum, lot) => {
    const price = latestPrices[lot.ticker];
    if (price === undefined) return sum;
    return sum + remainingQuantity(lot) * price;
  }, 0);
}

/** Reused by tax/lotDisposal for basis per unit. Exposed for testing. */
export function basisPerUnit(lot: Lot): number {
  return adjustedCostBasis(lot);
}

export type { CostBasisAdjustment };
