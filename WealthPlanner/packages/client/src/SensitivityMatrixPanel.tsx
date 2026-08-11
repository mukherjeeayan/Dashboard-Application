// Sensitivity Matrix screen (docs/09, "Sensitivity Matrix"). Read-only heatmap
// of ending corpus across a range of liquid (x) and locked (y) returns, with a
// colour scale from low (red) to high (green) corpus.

import { useEffect, useState } from "react";
import { api, type SensitivityMatrix } from "./api";
import { formatMoneyCompact } from "./format";

function heatColor(t: number): { r: number; g: number; b: number } {
  return { r: Math.round(235 - t * 135), g: Math.round(64 + t * 136), b: 64 };
}

function rgb({ r, g, b }: { r: number; g: number; b: number }): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Contrast-aware text colour (WCAG 1.4.3, AA): pick white or near-black text
// whichever gives the higher contrast ratio against a heatmap cell background.
function textColorFor(r: number, g: number, b: number): string {
  const L = luminance(r, g, b);
  const white = (1.05 / (L + 0.05));
  const dark = (L + 0.05) / 0.0556; // #111111
  return white >= dark ? "#fff" : "#111";
}

function Heatmap({ data, currency, locale }: { data: SensitivityMatrix; currency: string; locale: string }) {
  if (data.x.values.length === 0 || data.y.values.length === 0) return null;

  const all = data.rows.flat().filter((v): v is number => v !== null);
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const span = max - min || 1;

  return (
    <table className="heatmap">
      <thead>
        <tr>
          <th>Locked \\ Liquid</th>
          {data.x.values.map((v) => (
            <th key={v}>
              {(v * 100).toFixed(0)}%
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.y.values.map((y, yi) => (
          <tr key={y}>
            <th>{(y * 100).toFixed(0)}%</th>
            {data.rows[yi].map((cell, xi) => {
              const v = cell ?? 0;
              const t = (v - min) / span;
              return (
                <td
                  key={xi}
                  title={formatMoneyCompact(cell, currency, locale)}
                  style={{
                    background: rgb(heatColor(t)),
                    color: textColorFor(heatColor(t).r, heatColor(t).g, heatColor(t).b),
                  }}
                >
                  {formatMoneyCompact(cell, currency, locale)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SensitivityMatrixPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [data, setData] = useState<SensitivityMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .getSensitivityMatrix(planId)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [planId]);

  if (error) {
    return (
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Sensitivity Matrix</h3>
        </div>
        <p className="error">Could not load sensitivity matrix: {error}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Sensitivity Matrix</h3>
      </div>
      {!data ? (
        <p className="muted">Loading sensitivity matrix…</p>
      ) : data.rows.length === 0 ? (
        <p className="muted">
          No data yet. Add an account and target allocation above to see the ending-corpus grid.
        </p>
      ) : (
        <>
          <p className="card-body">
            Ending corpus by liquid (market) and locked (FD) return. Base case:{" "}
            <strong>{formatMoneyCompact(data.base, currency, locale)}</strong>.
          </p>
          <Heatmap data={data} currency={currency} locale={locale} />
          <p className="hint">
            Cell = deterministic ending corpus at that return pair (compact
            notation).
          </p>
        </>
      )}
    </section>
  );
}
