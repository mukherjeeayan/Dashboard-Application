// Tax screen (docs/09 "Tax"). Read-only post-tax retention comparison between
// systematic withdrawals (SWP) and a lump-sum drawdown of the corpus.

import { useEffect, useState } from "react";
import { api, type TaxAnalysis } from "./api";
import { formatMoney, formatPercent } from "./format";

function MetricRow({
  label,
  gross,
  tax,
  net,
  ratio,
  currency,
  locale,
}: {
  label: string;
  gross: number;
  tax: number;
  net: number;
  ratio: number;
  currency: string;
  locale: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-body">
        <div>Gross draw: <strong>{formatMoney(gross, currency, locale)}</strong></div>
        <div>Tax: <span className="error">{formatMoney(tax, currency, locale)}</span></div>
        <div>Net proceeds: <strong>{formatMoney(net, currency, locale)}</strong></div>
        <div>Retention: <strong>{formatPercent(ratio)}</strong></div>
      </div>
    </div>
  );
}

export function TaxPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [data, setData] = useState<TaxAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .getTaxAnalysis(planId)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [planId]);

  if (error) {
    return (
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Tax</h3>
        </div>
        <p className="error">Could not load tax analysis: {error}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Tax</h3>
      </div>
      {!data ? (
        <p className="muted">Loading tax analysis…</p>
      ) : (
        <>
          <p className="card-body">
            Post-tax drawdown on a total corpus of{" "}
            <strong>{formatMoney(data.totalCorpus, currency, locale)}</strong>.
          </p>
          <div className="stat-row">
            <MetricRow
              label="Systematic withdrawals (SWP)"
              gross={data.swp.gross}
              tax={data.swp.tax}
              net={data.swp.net}
              ratio={data.swpRetentionRatio}
              currency={currency}
              locale={locale}
            />
            <MetricRow
              label="Lump-sum drawdown"
              gross={data.lumpSum.gross}
              tax={data.lumpSum.tax}
              net={data.lumpSum.net}
              ratio={data.lumpSumRetentionRatio}
              currency={currency}
              locale={locale}
            />
          </div>
          <p className="muted" style={{ marginTop: "0.75rem" }}>{data.verdict}</p>
        </>
      )}
    </section>
  );
}
