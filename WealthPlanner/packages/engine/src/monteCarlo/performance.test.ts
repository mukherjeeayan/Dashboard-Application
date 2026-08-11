// Performance test (docs/12 §12.5, docs/07 §7.6). The heaviest engine
// (engineMacroCombined) at the full production load — 10,000 trials across a
// 41-year horizon — must complete within the documented target on typical
// consumer hardware. This runs in CI, so the threshold is deliberately loose
// (5s) to avoid flaky failures on shared runners while still catching
// order-of-magnitude regressions (e.g. an accidental per-year O(n²)).
import { describe, expect, it } from "vitest";
import { runMacroCombined } from "./engineMacroCombined";
import { loadPack } from "@wealthpath/jurisdictions";

const IN_2025 = loadPack("IN-2025");

const PERF_TARGET_MS = 5000; // docs/07 §7.6

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
  trialCount: 10000,
  seed: 21,
  pack: IN_2025,
};

describe("monteCarlo performance (docs/07 §7.6, docs/12 §12.5)", () => {
  it(
    "engineMacroCombined 10,000 trials x 41 years completes within the target",
    { timeout: 30_000 },
    () => {
      const started = Date.now();
      const res = runMacroCombined(input);
      const elapsed = Date.now() - started;
      // Sanity: the run actually did the work.
      expect(res.curves).toHaveLength(input.horizonYears);
      expect(res.curves[input.horizonYears - 1].P50).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(PERF_TARGET_MS);
    },
  );
});
