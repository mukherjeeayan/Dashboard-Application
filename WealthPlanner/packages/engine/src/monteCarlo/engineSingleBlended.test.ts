import { describe, expect, it } from "vitest";
import { runSingleBlended } from "./engineSingleBlended";

// Fixture: docs/15 §15.3.3 — a real 10,000-trial run of the Single Blended
// engine. Because the workbook's RNG differs from mulberry32, an exact
// reproduction is not expected; the statistical-tolerance approach (docs/12
// §12.4) is used: probability of success should land within a few points of
// the recorded 98.61%, and the percentile ordering / signs must be sane.
const INPUT = {
  fixedIncomeSleeve: 36_096_680.077,
  marketSleeve: 412_358_392.072,
  yearlyExpenditure: 4_349_232.33,
  fixedIncomeROI: 0.07,
  inflation: 0.08,
  marketMean: 0.12,
  marketVol: 0.18,
  crashFloor: -0.6,
  trialCount: 10_000,
  years: 41,
  seed: 12345,
};

describe("monteCarlo/engineSingleBlended (docs/15 §15.3.3)", () => {
  it("lands probability of success within tolerance of the recorded 98.61%", () => {
    const res = runSingleBlended(INPUT);
    expect(res.probabilityOfSuccess).toBeGreaterThan(0.90);
    expect(res.probabilityOfSuccess).toBeLessThan(0.999);
  });

  it("produces well-ordered, positive final-year percentiles", () => {
    const res = runSingleBlended(INPUT);
    const { P10, P50, P90 } = res.curves[INPUT.years - 1];
    expect(P10).toBeGreaterThan(0);
    expect(P50).toBeGreaterThan(P10);
    expect(P90).toBeGreaterThan(P50);
  });

  it("lands final-year percentiles within order-of-magnitude bands of the recorded run", () => {
    // Recorded (docs/15 §15.3.3): P10 ≈ ₹348.6c, Median ≈ ₹2,027c, P90 ≈ ₹8,510c.
    // A different PRNG stream won't reproduce the exact log-normal draws, but the
    // magnitudes must hold within generous bands (docs/12 §12.4 statistical-tolerance).
    const { P10, P50, P90 } = runSingleBlended(INPUT).curves[INPUT.years - 1];
    const c = (v: number) => v / 1e7; // convert to crore for readability
    expect(c(P10)).toBeGreaterThan(100); // recorded 348.6
    expect(c(P10)).toBeLessThan(600);
    expect(c(P50)).toBeGreaterThan(1000); // recorded 2027
    expect(c(P50)).toBeLessThan(4000);
    expect(c(P90)).toBeGreaterThan(3000); // recorded 8510
    expect(c(P90)).toBeLessThan(20000);
  });

  it("is reproducible for a fixed seed", () => {
    const a = runSingleBlended(INPUT);
    const b = runSingleBlended(INPUT);
    expect(a.median).toBeCloseTo(b.median, 9);
    expect(a.probabilityOfSuccess).toBe(b.probabilityOfSuccess);
  });
});
