import { describe, expect, it } from "vitest";
import { mulberry32 } from "./mulberry32";
import { normSInv, normSInvRnd } from "./acklamInverseNormal";

describe("mulberry32 (docs/07 §7.2)", () => {
  it("is deterministic for a given seed", () => {
    const draws = (seed: number, count: number) => {
      const rng = mulberry32(seed);
      return Array.from({ length: count }, () => rng());
    };
    expect(draws(12345, 8)).toEqual(draws(12345, 8));
    // A different seed produces a different stream.
    expect(draws(12345, 8)).not.toEqual(draws(54321, 8));
  });

  it("produces uniform draws in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 10_000; i++) {
      const u = rng();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe("acklam inverse normal CDF (docs/15 §15.1)", () => {
  it("reproduces the documented reference quantiles", () => {
    expect(normSInv(0.5)).toBeCloseTo(0, 9);
    expect(normSInv(0.975)).toBeCloseTo(1.959964, 4);
    expect(normSInv(0.025)).toBeCloseTo(-1.959964, 4);
    expect(normSInv(0.9861)).toBeCloseTo(2.198, 2);
  });

  it("is antisymmetric around p = 0.5", () => {
    for (const p of [0.01, 0.1, 0.3, 0.4, 0.49]) {
      expect(normSInv(p)).toBeCloseTo(-normSInv(1 - p), 6);
    }
  });

  it("NormSInvRnd clamps the uniform draw to avoid singularities", () => {
    // Exactly at the extremes the raw algorithm would take Log(0)/Log(negative).
    expect(Number.isFinite(normSInvRnd(0))).toBe(true);
    expect(Number.isFinite(normSInvRnd(1))).toBe(true);
    // The clamp resolves u→0 to a finite left-tail draw and u→1 to the mirror.
    expect(normSInvRnd(0)).toBeLessThan(0);
    expect(normSInvRnd(1)).toBeGreaterThan(0);
  });
});
