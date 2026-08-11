// Retirement glide path (docs/06 §6.3, source §3.3.3). Precomputed as a
// year-by-year weight table (Equity/Gold/Debt/Cash), not purely parametric:
// equity declines by a per-year step from a start weight down to a floor;
// gold is held constant; debt absorbs the released equity share (default 85%,
// the rest to cash). Both the deterministic projection and the Macro Monte
// Carlo engine look up the same table.

export interface GlidePathParams {
  startingEquityPct: number;
  equityGlideDownStepPpPerYear: number;
  equityFloorPct: number;
  goldPctHeldConstant: number;
  debtShareOfReleasedEquity: number;
}

export interface YearlyWeights {
  EQUITY: number;
  GOLD: number;
  DEBT: number;
  CASH: number;
}

export function buildGlidePath(params: GlidePathParams, years: number): YearlyWeights[] {
  const weights: YearlyWeights[] = [];
  for (let y = 0; y < years; y++) {
    const equity = Math.max(params.equityFloorPct, params.startingEquityPct - params.equityGlideDownStepPpPerYear * y);
    const gold = params.goldPctHeldConstant;
    // Debt absorbs `debtShare` of the released equity share; the rest is cash.
    const released = Math.max(0, params.startingEquityPct - equity);
    const debt = params.debtShareOfReleasedEquity * released;
    const cash = 1 - equity - gold - debt;
    weights.push({ EQUITY: equity, GOLD: gold, DEBT: debt, CASH: cash });
  }
  return weights;
}
