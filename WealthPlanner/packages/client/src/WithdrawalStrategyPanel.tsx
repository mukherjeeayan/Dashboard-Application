// Withdrawal Strategy screen (docs/09, "Withdrawal Strategy"). Read-only
// comparison of the jurisdiction's statutory withdrawal waterfall against a
// simple pooled draw on the same two-sleeve projection, exposing how much
// ending corpus the ordering rules preserve.

import { useEffect, useState } from "react";
import { api, type WithdrawalStrategy } from "./api";
import { formatMoney, formatSignedPercent } from "./format";

const WIDTH = 640;
const HEIGHT = 280;
const PAD = 8;

/** Builds an SVG path through the given [x, y] points. */
function linePath(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Dual-line chart of total corpus under each withdrawal strategy. */
function ComparisonChart({
  data,
  currency,
  locale,
}: {
  data: WithdrawalStrategy;
  currency: string;
  locale: string;
}) {
  if (data.years === 0) return null;

  const max = Math.max(
    ...data.waterfall.map((r) => r.totalCorpus),
    ...data.pooled.map((r) => r.totalCorpus),
    1,
  );
  const innerW = WIDTH - PAD * 2;
  const innerH = HEIGHT - PAD * 2;
  const x = (i: number) =>
    PAD + (data.years === 1 ? innerW / 2 : (i / (data.years - 1)) * innerW);
  const y = (v: number) => PAD + innerH - (v / max) * innerH;

  const waterfall = data.waterfall.map((r, i) => [x(i), y(r.totalCorpus)] as [number, number]);
  const pooled = data.pooled.map((r, i) => [x(i), y(r.totalCorpus)] as [number, number]);

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="Ending corpus by year: withdrawal waterfall vs pooled draw"
      >
        <path d={linePath(waterfall)} fill="none" stroke="#1a73e8" strokeWidth={2.5} />
        <path d={linePath(pooled)} fill="none" stroke="#9a5b00" strokeWidth={2.5} />
        <text x={PAD} y={PAD + 12} fontSize="12" fill="#1a73e8">
          Waterfall
        </text>
        <text x={PAD + 64} y={PAD + 12} fontSize="12" fill="#9a5b00">
          Pooled
        </text>
      </svg>
      <figcaption className="chart-cap">
        Projected total corpus by year under each strategy. Peak{" "}
        {formatMoney(max, currency, locale)}.
      </figcaption>
    </figure>
  );
}

export function WithdrawalStrategyPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [data, setData] = useState<WithdrawalStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .getWithdrawalStrategies(planId)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [planId]);

  if (error) {
    return (
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Withdrawal Strategy</h3>
        </div>
        <p className="error">Could not load withdrawal strategies: {error}</p>
      </section>
    );
  }

  const endingPct =
    data && data.waterfall[data.years - 1] && data.waterfall[data.years - 1].totalCorpus > 0
      ? data.endingDifference / data.waterfall[data.years - 1].totalCorpus
      : 0;

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Withdrawal Strategy</h3>
      </div>
      {!data ? (
        <p className="muted">Loading withdrawal strategies…</p>
      ) : data.years === 0 ? (
        <p className="muted">
          No data yet. Add an account above to compare withdrawal strategies.
        </p>
      ) : (
        <>
          <ComparisonChart data={data} currency={currency} locale={locale} />
          <p className="card-body">
            Ending corpus: <strong className={data.endingDifference >= 0 ? "success" : "error"}>{formatMoney(data.waterfall[data.years - 1].totalCorpus, currency, locale)}</strong>{" "}
            (waterfall) vs{" "}
            <strong>{formatMoney(data.pooled[data.years - 1].totalCorpus, currency, locale)}</strong> (pooled) — the
            statutory ordering rules preserve{" "}
            <strong className={data.endingDifference >= 0 ? "success" : "error"}>{formatSignedPercent(endingPct)}</strong>{" "}
            ({data.endingDifference >= 0 ? "+" : ""}
            {formatMoney(data.endingDifference, currency, locale)}).
          </p>
          {!data.waterfallEnabled && (
            <p className="hint">
              Note: the waterfall is currently disabled in this plan's assumptions; this is the
              hypothetical ordering-preserving outcome.
            </p>
          )}
        </>
      )}
    </section>
  );
}
