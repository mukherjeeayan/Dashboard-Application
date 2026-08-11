// Pure geometry helpers for rendering the Monte Carlo fan chart (Phase 5,
// "Projection screen"). Kept free of React/DOM so the layout can be unit
// tested directly. Input is the engine's per-year P10/P50/P90 fan data.

export interface CurvePoint {
  x: number;
  y: number;
}

export interface FanGeometry {
  width: number;
  height: number;
  /** P10..P90 band, one band segment per year (top = P90, bottom = P10). */
  band: Array<{ x: number; top: number; bottom: number }>;
  /** The median (P50) polyline. */
  median: CurvePoint[];
  /** Largest value across all years (used for the y-axis). */
  max: number;
  /** Smallest value across all years. */
  min: number;
}

export interface FanInputPoint {
  year: number;
  P10: number;
  P50: number;
  P90: number;
}

/**
 * Maps fan-curve data into SVG pixel coordinates. The y-axis is linear over
 * [min, max] of the P10/P90 values, inverted so larger values draw higher.
 */
export function layoutFanCurve(
  curves: FanInputPoint[],
  width: number,
  height: number,
  pad: number,
): FanGeometry {
  if (curves.length === 0) {
    return { width, height, band: [], median: [], max: 0, min: 0 };
  }

  let max = -Infinity;
  let min = Infinity;
  for (const c of curves) {
    max = Math.max(max, c.P10, c.P90);
    min = Math.min(min, c.P10, c.P90);
  }
  const span = max - min === 0 ? 1 : max - min;

  const yearMin = curves[0].year;
  const yearMax = curves[curves.length - 1].year;
  const yearSpan = yearMax - yearMin === 0 ? 1 : yearMax - yearMin;

  const x = (year: number): number =>
    pad + ((year - yearMin) / yearSpan) * (width - 2 * pad);
  const y = (v: number): number =>
    height - pad - ((v - min) / span) * (height - 2 * pad);

  const band = curves.map((c) => ({
    x: x(c.year),
    top: y(c.P90),
    bottom: y(c.P10),
  }));
  const median = curves.map((c) => ({ x: x(c.year), y: y(c.P50) }));

  return { width, height, band, median, max, min };
}

/** Builds an SVG `d` path string for the given polyline points. */
export function polylinePath(points: CurvePoint[]): string {
  if (points.length === 0) return "";
  const parts = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`);
  }
  return parts.join(" ");
}

/** Builds a closed polygon `d` path for the P10..P90 band (a filled ribbon). */
export function bandPath(band: FanGeometry["band"]): string {
  if (band.length === 0) return "";
  const top = band.map((p) => `${p.x.toFixed(2)},${p.top.toFixed(2)}`);
  const bottom = [...band]
    .reverse()
    .map((p) => `${p.x.toFixed(2)},${p.bottom.toFixed(2)}`);
  return `M ${top.join(" L ")} L ${bottom.join(" L ")} Z`;
}
