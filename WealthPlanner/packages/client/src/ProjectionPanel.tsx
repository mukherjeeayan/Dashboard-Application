// Projection screen (docs/09, "Projection"). Read-only: a year-by-year table
// plus a stacked area chart of the locked vs liquid sleeve (docs/09 §9.4).
// Rendered from the deterministic two-sleeve projection endpoint.

import { useEffect, useState } from "react";
import { api, type Projection } from "./api";
import { formatMoney } from "./format";

const WIDTH = 640;
const HEIGHT = 280;
const PAD = 8;

/** Builds an SVG path through the given [x, y] points. */
function linePath(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Stacked area chart of locked (bottom) + liquid (top) sleeve = total corpus. */
function AreaChart({
  projection,
  currency,
  locale,
}: {
  projection: Projection;
  currency: string;
  locale: string;
}) {
  const rows = projection.rows;
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.totalCorpus), 1);
  const innerW = WIDTH - PAD * 2;
  const innerH = HEIGHT - PAD * 2;
  const x = (i: number) => PAD + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const y = (v: number) => PAD + innerH - (v / max) * innerH;

  const lockedTop = rows.map((r, i) => [x(i), y(r.lockedBalance)] as [number, number]);
  const totalTop = rows.map((r, i) => [x(i), y(r.totalCorpus)] as [number, number]);
  const lockedBottom = [...lockedTop].reverse().map(([px]) => [px, y(0)] as [number, number]);

  const totalClosed: Array<[number, number]> = [
    ...totalTop,
    ...[...lockedTop].reverse(),
    [x(0), y(0)],
  ];

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="Projection of locked vs liquid sleeve by year"
      >
        <defs>
          <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1a73e8" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="lockedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8a23d" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e8a23d" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path d={linePath(totalClosed)} fill="url(#liquidGrad)" stroke="none" />
        <path d={linePath(lockedBottom)} fill="url(#lockedGrad)" stroke="none" />
        <path d={linePath(lockedTop)} fill="none" stroke="#7a4400" strokeWidth={2} />
        <text x={PAD} y={PAD + 12} fontSize="12" fill="#1a73e8">
          Liquid
        </text>
        <text x={PAD + 48} y={PAD + 12} fontSize="12" fill="#7a4400">
          Locked
        </text>
      </svg>
      <figcaption className="chart-cap">
        Projected corpus by year (locked vs liquid sleeve). Peak {formatMoney(max, currency, locale)}.
      </figcaption>
    </figure>
  );
}

export function ProjectionPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProjection(null);
    setError(null);
    api.getProjection(planId).then(setProjection).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [planId]);

  if (error) {
    return (
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Projection</h3>
        </div>
        <p className="error">Could not load projection: {error}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Projection</h3>
      </div>
      {!projection ? (
        <p className="muted">Loading projection…</p>
      ) : projection.rows.length === 0 ? (
        <p className="muted">
          No projection data yet. Add an account above to see your projected corpus.
        </p>
      ) : (
        <>
          <AreaChart projection={projection} currency={currency} locale={locale} />
          <table className="table">
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Expense</th>
                <th className="num">Liquid</th>
                <th className="num">Locked</th>
                <th className="num">Total corpus</th>
              </tr>
            </thead>
            <tbody>
              {projection.rows.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  <td className="num">{formatMoney(r.expense, currency, locale)}</td>
                  <td className="num">{formatMoney(r.liquidBalance, currency, locale)}</td>
                  <td className="num">{formatMoney(r.lockedBalance, currency, locale)}</td>
                  <td className="num">{formatMoney(r.totalCorpus, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
