import { describe, expect, it } from "vitest";
import { loadPack } from "@wealthpath/jurisdictions";
import type { TwoSleeveProjectionInput } from "../projection/twoSleeve";
import { sensitivityMatrix } from "./sensitivityMatrix";
import { scenarioAnalysis } from "./scenarioAnalysis";

const PACK = loadPack("IN-2025");

function baseInput(): TwoSleeveProjectionInput {
  return {
    liquidSleeveAtRetirement: 2_000_000,
    lockedSleeveAtRetirement: 1_000_000,
    baseAnnualExpense: 200_000,
    lifestyleMultiplier: 1,
    inflationParams: {
      longRunMean: 0.075,
      meanReversionSpeed: 0.2,
      shockVolatility: 0,
      floor: 0,
      ceiling: 0.15,
      rateHikeTriggerThreshold: 1,
      rateHikeExtraReversionSpeed: 0,
    },
    startingInflation: 0.075,
    glidePathParams: {
      startingEquityPct: 0.7,
      equityGlideDownStepPpPerYear: 0.02,
      equityFloorPct: 0.3,
      goldPctHeldConstant: 0.1,
      debtShareOfReleasedEquity: 0.85,
    },
    liquidReturn: 0.12,
    lockedReturn: 0.07,
    horizonYears: 10,
    withdrawalWaterfallEnabled: true,
    pack: PACK,
    // Deterministic zero-shock inflation path.
    normalDraw: () => 0,
  };
}

describe("sensitivityMatrix", () => {
  it("produces a grid with an axis-matching shape and a base anchor", () => {
    const grid = sensitivityMatrix(baseInput(), [0.08, 0.12, 0.16], [0.05, 0.07, 0.09]);
    expect(grid.x.values).toEqual([0.08, 0.12, 0.16]);
    expect(grid.y.values).toEqual([0.05, 0.07, 0.09]);
    expect(grid.rows).toHaveLength(3);
    for (const row of grid.rows) expect(row).toHaveLength(3);
    expect(grid.base).toBeGreaterThan(0);
    // The midpoint (liquid 0.12, locked 0.07) equals the base anchor.
    expect(grid.rows[1][1]).toBe(grid.base);
  });

  it("increases ending corpus with higher returns", () => {
    const grid = sensitivityMatrix(baseInput(), [0.08, 0.16], [0.05, 0.09]);
    // Moving along the x-axis (more liquid return) at fixed y should raise corpus.
    expect(grid.rows[0][1] ?? 0).toBeGreaterThan(grid.rows[0][0] ?? 0);
  });
});

describe("scenarioAnalysis", () => {
  it("orders best >= base >= worst and reports a spread", () => {
    const result = scenarioAnalysis(baseInput());
    const byLabel = Object.fromEntries(result.scenarios.map((s) => [s.label, s]));
    expect(byLabel.best.endingCorpus).toBeGreaterThan(byLabel.base.endingCorpus);
    expect(byLabel.base.endingCorpus).toBeGreaterThan(byLabel.worst.endingCorpus);
    expect(result.spread).toBeCloseTo(byLabel.best.endingCorpus - byLabel.worst.endingCorpus, 6);
    expect(byLabel.base.deltaVsBase).toBe(0);
    expect(byLabel.best.deltaVsBase).toBeGreaterThan(0);
    expect(byLabel.worst.deltaVsBase).toBeLessThan(0);
  });
});
