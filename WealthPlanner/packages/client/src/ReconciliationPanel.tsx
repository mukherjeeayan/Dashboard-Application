// Balance Reconciliation screen (docs/09 §9.3 step 5). Bulk period-end entry of
// actual balances for a plan's accounts, replacing the workbook's manual
// reconciliation column. Current balances are prefilled for editing.

import { useCallback, useEffect, useState } from "react";
import { api, type ReconciliationRow } from "./api";
import { formatMoney } from "./format";

export function ReconciliationPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const data = await api.getReconciliation(planId);
    setRows(data);
    setEdits(Object.fromEntries(data.map((r) => [r.accountId, String(r.currentBalance)])));
  }, [planId]);

  useEffect(() => {
    load().catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [load]);

  const save = async () => {
    setMsg(null);
    setErr(null);
    const payload = {
      periodEnd,
      rows: rows.map((r) => ({ accountId: r.accountId, actualBalance: Number(edits[r.accountId]) })),
    };
    const res = await api.putReconciliation(planId, payload);
    setMsg(`Reconciled ${res.reconciled} account(s) for ${res.periodEnd}.`);
    await load();
  };

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Balance Reconciliation</h3>
      </div>
      <p className="muted">
        Enter actual account balances for a period end; they are written back to each account&apos;s
        current balance and recorded in history.
      </p>

      {err && <p className="error">{err}</p>}
      {msg && <p className="muted">{msg}</p>}

      <label className="field" style={{ marginTop: "0.5rem" }}>
        Period end
        <input className="input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={{ width: 160 }} />
      </label>

      <table className="table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Instrument</th>
            <th className="num">Current</th>
            <th className="num">Actual balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountId}>
              <td>{r.label}</td>
              <td>{r.instrumentType}</td>
              <td className="num">{formatMoney(r.currentBalance, currency, locale)}</td>
              <td className="num">
                <input
                  className="input"
                  type="number"
                  value={edits[r.accountId] ?? ""}
                  onChange={(e) => setEdits({ ...edits, [r.accountId]: e.target.value })}
                  style={{ width: 140 }}
                  aria-label={`Actual balance for ${r.label}`}
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No accounts to reconcile.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <button onClick={save} className="btn" style={{ marginTop: "0.75rem" }}>
        Save reconciliation
      </button>
    </section>
  );
}
