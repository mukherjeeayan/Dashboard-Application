// Emergency Fund screen (docs/09 §9.3, engine emergencyFund.ts). Assesses the
// plan's liquid cash against a user-chosen coverage target in real (today's
// money) purchasing power, prefilling inputs from the plan's liquid balances
// and inflation assumption so the user can experiment with coverage.

import { useCallback, useEffect, useState } from "react";
import { api, type EmergencyFundResult } from "./api";
import { formatMoney } from "./format";

export function EmergencyFundPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [coverageMonths, setCoverageMonths] = useState("6");
  const [monthlyExpense, setMonthlyExpense] = useState("");
  const [liquidBalance, setLiquidBalance] = useState(0);
  const [result, setResult] = useState<EmergencyFundResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const inputs = await api.getEmergencyFundInputs(planId);
    setLiquidBalance(inputs.liquidBalance);
  }, [planId]);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [load]);

  const assess = async () => {
    setMsg(null);
    setErr(null);
    const data = await api.assessEmergencyFund(planId, {
      targetCoverageMonths: Number(coverageMonths),
      monthlyExpense: Number(monthlyExpense),
    });
    setResult(data);
    setLiquidBalance(data.liquidBalance);
    setMsg("Assessment updated.");
  };

  const fmt = (v: number) => formatMoney(v, currency, locale);

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Emergency Fund</h3>
      </div>
      <p className="muted">
        Your liquid balance is {fmt(liquidBalance)}. Set a coverage target to check how much of your
        monthly expense the fund covers in today&apos;s purchasing power.
      </p>

      {err && <p className="error">{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      <div className="row">
        <label className="field">
          Coverage (months)
          <input className="input" type="number" value={coverageMonths} onChange={(e) => setCoverageMonths(e.target.value)} style={{ width: 130 }} />
        </label>
        <label className="field">
          Monthly expense
          <input className="input" type="number" value={monthlyExpense} onChange={(e) => setMonthlyExpense(e.target.value)} style={{ width: 130 }} />
        </label>
        <button onClick={assess} className="btn">Assess</button>
      </div>

      {result && (
        <div className="stat-row" style={{ marginTop: "0.75rem" }}>
          <Stat label="Target amount" value={fmt(result.targetAmount)} />
          <Stat label="Liquid balance" value={fmt(result.currentBalance)} />
          <Stat label="Real value" value={fmt(result.realValueAtEnd)} />
          <Stat label="Gap" value={fmt(result.gapAtEnd)} />
          <Stat label="On target" value={result.onTarget ? "Yes" : "No"} />
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
