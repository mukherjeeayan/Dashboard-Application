// Scenario Analysis screen (docs/09, "Scenario Analysis"). Read-only comparison
// of best / base / worst ending corpus under shifted return assumptions, with
// the best-minus-worst spread and each scenario's delta vs the base.

import { useEffect, useState } from "react";
import { api, type ScenarioSet } from "./api";
import { formatMoney, formatPercent } from "./format";

const LABEL_COLOR: Record<string, string> = {
  best: "#1a7f37",
  base: "#1a73e8",
  worst: "#c00",
};

export function ScenarioAnalysisPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [data, setData] = useState<ScenarioSet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .getScenarioAnalysis(planId)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [planId]);

  if (error) {
    return (
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Scenario Analysis</h3>
        </div>
        <p className="error">Could not load scenario analysis: {error}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Scenario Analysis</h3>
      </div>
      {!data ? (
        <p className="muted">Loading scenario analysis…</p>
      ) : data.scenarios.length === 0 ? (
        <p className="muted">
          No data yet. Add an account above to see best/base/worst scenario outcomes.
        </p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th className="num">Liquid return</th>
                <th className="num">Locked return</th>
                <th className="num">Ending corpus</th>
                <th className="num">vs base</th>
              </tr>
            </thead>
            <tbody>
              {data.scenarios.map((s) => (
                <tr key={s.label}>
                  <td>
                    <span style={{ color: LABEL_COLOR[s.label], fontWeight: 600 }}>
                      {s.label.charAt(0).toUpperCase() + s.label.slice(1)}
                    </span>
                  </td>
                  <td className="num">{formatPercent(s.liquidReturn)}</td>
                  <td className="num">{formatPercent(s.lockedReturn)}</td>
                  <td className="num">{formatMoney(s.endingCorpus, currency, locale)}</td>
                  <td className={`num ${s.deltaVsBase >= 0 ? "success" : "error"}`}>
                    {s.deltaVsBase >= 0 ? "+" : ""}
                    {formatMoney(s.deltaVsBase, currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="card-body">
            Best–worst spread:{" "}
            <strong>{formatMoney(data.spread, currency, locale)}</strong>.
          </p>
        </>
      )}
    </section>
  );
}
