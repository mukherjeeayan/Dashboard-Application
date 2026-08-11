import { describe, expect, it } from "vitest";
import {
  layoutFanCurve,
  polylinePath,
  bandPath,
  type FanInputPoint,
} from "./chart";

const CURVES: FanInputPoint[] = [
  { year: 1, P10: 100, P50: 110, P90: 120 },
  { year: 2, P10: 90, P50: 121, P90: 150 },
  { year: 3, P10: 80, P50: 133, P90: 180 },
];

describe("layoutFanCurve", () => {
  it("maps the first year to the left edge and last year to the right edge", () => {
    const g = layoutFanCurve(CURVES, 200, 100, 10);
    expect(g.median[0].x).toBe(10);
    expect(g.median[g.median.length - 1].x).toBeCloseTo(190);
  });

  it("inverts y so larger values draw higher (smaller pixel y)", () => {
    const g = layoutFanCurve(CURVES, 200, 100, 10);
    const { y } = g.median[0]; // year 1 median 110
    const last = g.median[2].y; // year 3 median 133 (larger)
    expect(last).toBeLessThan(y);
  });

  it("reports the min/max across the P10/P90 fan", () => {
    const g = layoutFanCurve(CURVES, 200, 100, 10);
    expect(g.max).toBe(180);
    expect(g.min).toBe(80);
  });

  it("returns empty geometry for no curves", () => {
    const g = layoutFanCurve([], 200, 100, 10);
    expect(g.band).toEqual([]);
    expect(g.median).toEqual([]);
  });
});

describe("path builders", () => {
  it("builds a polyline path", () => {
    const path = polylinePath([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ]);
    expect(path).toContain("M 0.00 0.00");
    expect(path).toContain("L 10.00 20.00");
  });

  it("builds a closed band polygon", () => {
    const g = layoutFanCurve(CURVES, 200, 100, 10);
    const path = bandPath(g.band);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    // Top edge is drawn P90..P90 left-to-right, then P10..P10 back.
    expect(path).toContain("L");
  });
});
