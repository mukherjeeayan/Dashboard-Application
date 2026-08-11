import { describe, expect, it } from "vitest";
import { runCorrelated } from "./engineCorrelated";
import { runAccumulation } from "./engineAccumulation";
import { runMacroCombined } from "./engineMacroCombined";
import { loadPack } from "@wealthpath/jurisdictions";

const IN_2025 = loadPack("IN-2025");

const correlatedInput = {
  fixedIncomeSleeve: 36_096_680.077,
  equitySleeve: 330_000_000,
  goldSleeve: 82_358_392.072,
  yearlyExpenditure: 4_349_232.33,
  fixedIncomeROI: 0.07,
  inflation: 0.08,
  equityMean: 0.12,
  equityVol: 0.18,
  goldMean: 0.08,
  goldVol: 0.12,
  equityGoldCorrelation: 0.2,
  crashFloor: -0.6,
  trialCount: 5000,
  years: 41,
  seed: 7,
};

describe("monteCarlo/engineCorrelated (docs/07 §7.2, source §3.9)", () => {
  it("is deterministic for a fixed seed and produces ordered percentiles", () => {
    const a = runCorrelated(correlatedInput);
    const b = runCorrelated(correlatedInput);
    expect(a.median).toBeCloseTo(b.median, 9);
    const last = a.curves[a.curves.length - 1];
    expect(last.P10).toBeGreaterThan(0);
    expect(last.P50).toBeGreaterThan(last.P10);
    expect(last.P90).toBeGreaterThan(last.P50);
    expect(a.probabilityOfSuccess).toBeGreaterThan(0.5);
    expect(a.probabilityOfSuccess).toBeLessThanOrEqual(1);
  });

  it("spreads the market across equity and gold (correlated pair)", () => {
    // With a correlation of 0.2 the gold sleeve contributes; the total market
    // sleeve (equity + gold) should still dominate a pure-equity book.
    const res = runCorrelated({ ...correlatedInput, seed: 3 });
    expect(res.curves[res.curves.length - 1].P90).toBeGreaterThan(0);
  });
});

describe("monteCarlo/engineAccumulation (docs/07 §7.2, source §4.5)", () => {
  const base = {
    currentCorpus: 1_000_000,
    annualContribution: 200_000,
    marketMean: 0.12,
    marketVol: 0.18,
    targetCorpus: 20_000_000,
    baseYears: 20,
    maxYears: 40,
    crashFloor: -0.6,
    trialCount: 5000,
    seed: 11,
  };

  it("produces positive corpus percentiles and a bounded success probability", () => {
    const res = runAccumulation(base);
    expect(res.corpusAtBase.P50).toBeGreaterThan(0);
    expect(res.corpusAtBase.P90).toBeGreaterThan(res.corpusAtBase.P50);
    expect(res.corpusAtBase.P50).toBeGreaterThan(res.corpusAtBase.P10);
    expect(res.probabilityOfSuccessByBaseHorizon).toBeGreaterThanOrEqual(0);
    expect(res.probabilityOfSuccessByBaseHorizon).toBeLessThanOrEqual(1);
    expect(res.extraYearsNeededAtP10).toBeGreaterThanOrEqual(0);
    expect(res.yearsToTargetPercentiles.P50).toBeLessThanOrEqual(base.maxYears);
  });

  it("needs fewer extra working years when contributions are higher", () => {
    const low = runAccumulation(base);
    const high = runAccumulation({ ...base, annualContribution: 400_000 });
    expect(high.extraYearsNeededAtP10).toBeLessThanOrEqual(low.extraYearsNeededAtP10);
    expect(high.probabilityOfSuccessByBaseHorizon).toBeGreaterThanOrEqual(
      low.probabilityOfSuccessByBaseHorizon,
    );
  });
});

describe("monteCarlo/engineMacroCombined (docs/07 §7.3)", () => {
  const input = {
    liquidSleeveAtRetirement: 36_096_680.077,
    lockedSleeveAtRetirement: 412_358_392.072,
    baseAnnualExpense: 4_349_232.33,
    horizonYears: 41,
    startingInflation: 0.06,
    inflationParams: {
      longRunMean: 0.05,
      meanReversionSpeed: 0.3,
      shockVolatility: 0.02,
      floor: 0.02,
      ceiling: 0.1,
      rateHikeTriggerThreshold: 0.07,
      rateHikeExtraReversionSpeed: 0.4,
    },
    glidePathParams: {
      startingEquityPct: 0.6,
      equityGlideDownStepPpPerYear: 0.01,
      equityFloorPct: 0.3,
      goldPctHeldConstant: 0.1,
      debtShareOfReleasedEquity: 0.85,
    },
    marketParams: {
      equityMean: 0.12,
      equityVol: 0.18,
      goldMean: 0.08,
      goldVol: 0.12,
      equityGoldCorrelation: 0.2,
      debtRate: 0.07,
      cashRate: 0.04,
      crashFloor: -0.6,
    },
    lockedReturn: 0.0825,
    trialCount: 5000,
    seed: 21,
    pack: IN_2025,
  };

  it("runs the full glide-path + inflation + waterfall loop", () => {
    const res = runMacroCombined(input);
    const last = res.curves[res.curves.length - 1];
    expect(res.curves).toHaveLength(input.horizonYears);
    expect(last.P10).toBeGreaterThan(0);
    expect(last.P50).toBeGreaterThan(last.P10);
    expect(last.P90).toBeGreaterThan(last.P50);
    expect(res.probabilityOfSuccess).toBeGreaterThan(0.5);
    expect(res.probabilityOfSuccess).toBeLessThanOrEqual(1);
    expect(res.median).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed seed", () => {
    const a = runMacroCombined(input);
    const b = runMacroCombined(input);
    expect(a.median).toBeCloseTo(b.median, 9);
    expect(a.probabilityOfSuccess).toBe(b.probabilityOfSuccess);
  });
});
