import { layoutFanCurve, polylinePath, bandPath, type FanInputPoint } from "./chart";
import { formatMoney } from "./format";

const WIDTH = 640;
const HEIGHT = 280;
const PAD = 8;

/** Hand-rolled SVG fan chart (docs/09, "Projection screen"). Renders the P10..P90
 *  confidence band and the P50 median line from the engine's per-year curves. */
export function FanChart({
  curves,
  currency,
  locale = "en-IN",
}: {
  curves: FanInputPoint[];
  currency: string;
  locale?: string;
}) {
  const g = layoutFanCurve(curves, WIDTH, HEIGHT, PAD);

  const fmt = (v: number) => formatMoney(v, currency, locale);

  if (curves.length === 0) {
    return <p style={{ color: "#6b6b6b" }}>No simulation data yet.</p>;
  }

  return (
    <figure style={{ margin: "1rem 0" }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="auto" role="img" aria-label="Monte Carlo fan chart">
        <defs>
          <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4c8bf5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4c8bf5" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d={bandPath(g.band)} fill="url(#band)" stroke="none" />
        <path d={polylinePath(g.median)} fill="none" stroke="#1a73e8" strokeWidth={2} />
        <text x={PAD} y={PAD + 12} fontSize="12" fill="#6b6b6b">
          P90
        </text>
        <text x={PAD} y={HEIGHT - PAD} fontSize="12" fill="#6b6b6b">
          P10
        </text>
      </svg>
      <figcaption style={{ fontSize: "0.85rem", color: "#6b6b6b", marginTop: "0.25rem" }}>
        Projected corpus by year (P10–P90 range, median line). Range {fmt(g.min)} – {fmt(g.max)}
      </figcaption>
    </figure>
  );
}
