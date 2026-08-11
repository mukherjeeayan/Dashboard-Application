// Sequence Risk screen (docs/09, "Sequence Risk"). Manual-entry table of annual
// returns (replacing the workbook's "paste into column B"); the engine runs the
// series forward and reversed and the gap is called out numerically, with a
// dual-order chart of the cumulative corpus.

import { useCallback, useEffect, useState } from "react";
import { api, type SequenceRisk } from "./api";
import { formatMoney } from "./format";

const WIDTH = 640;
const HEIGHT = 260;
const PAD = 10;

function linePath(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Cumulative-corpus series under forward and reversed return order. */
function cumSeries(start: number, returns: number[]): number[] {
  const out: number[] = [];
  let bal = start;
  for (const r of returns) {
    bal = bal * (1 + r);
    out.push(bal);
  }
  return out;
}

function DualOrderChart({ start, returns }: { start: number; returns: number[] }) {
  if (returns.length === 0) return null;
  const forward = cumSeries(start, returns);
  const reversed = cumSeries(start, [...returns].reverse());
  const max = Math.max(...forward, ...reversed, start);
  const min = Math.min(...forward, ...reversed, start);
  const span = Math.max(1, max - min);
  const n = returns.length;
  const x = (i: number) => PAD + (n === 1 ? (WIDTH - PAD * 2) / 2 : (i / (n - 1)) * (WIDTH - PAD * 2));
  const y = (v: number) => PAD + (HEIGHT - PAD * 2) * (1 - (v - min) / span);

  const fwdPts = forward.map((v, i) => [x(i), y(v)] as [number, number]);
  const revPts = reversed.map((v, i) => [x(i), y(v)] as [number, number]);

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="Sequence risk dual-order chart"
      >
        <path d={linePath(fwdPts)} fill="none" stroke="#1a73e8" strokeWidth={2} />
        <path d={linePath(revPts)} fill="none" stroke="#9a5b00" strokeWidth={2} />
        <text x={PAD} y={PAD + 12} fontSize="12" fill="#1a73e8">
          Forward
        </text>
        <text x={PAD + 64} y={PAD + 12} fontSize="12" fill="#9a5b00">
          Reversed
        </text>
      </svg>
    </figure>
  );
}

export function SequenceRiskPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [returns, setReturns] = useState<number[]>([]);
  const [startingBalance, setStartingBalance] = useState(0);
  const [result, setResult] = useState<SequenceRisk["result"]>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    const data = await api.getSequenceRisk(planId);
    setReturns(
      [...data.returns].sort((a, b) => a.yearIndex - b.yearIndex).map((r) => r.annualReturn),
    );
    setStartingBalance(data.startingBalance);
    setResult(data.result);
  }, [planId]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const save = async () => {
    setMsg(null);
    const rows = returns.map((annualReturn, yearIndex) => ({ yearIndex, annualReturn }));
    const data = await api.putSequenceRisk(planId, rows);
    setStartingBalance(data.startingBalance);
    setResult(data.result);
    setMsg("Saved.");
  };

  const setReturn = (i: number, v: string) => {
    const next = [...returns];
    const n = Number(v);
    next[i] = Number.isFinite(n) ? n / 100 : next[i];
    setReturns(next);
  };

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Sequence Risk</h3>
      </div>
      <p className="muted">
        Enter the plan&apos;s annual returns; the engine runs them forward and reversed to expose
        sequence-of-returns risk.
      </p>

      <table className="table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Return %</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {returns.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <input
                  className="input"
                  type="number"
                  value={Math.round(r * 1000) / 10}
                  onChange={(e) => setReturn(i, e.target.value)}
                  style={{ width: 90 }}
                  aria-label={`Return year ${i + 1}`}
                />
              </td>
              <td>
                <button onClick={() => setReturns(returns.filter((_, j) => j !== i))} className="btn sm secondary">
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {returns.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No returns entered yet. Add one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="row">
        <input
          className="input"
          type="number"
          placeholder="Add return %"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLInputElement).value !== "") {
              const n = Number((e.target as HTMLInputElement).value);
              if (Number.isFinite(n)) setReturns([...returns, n / 100]);
              (e.target as HTMLInputElement).value = "";
            }
          }}
          style={{ width: 160 }}
          aria-label="New return percentage"
        />
        <button onClick={save} className="btn">
          Save & compute
        </button>
        {msg && <span className="muted">{msg}</span>}
      </div>

      {result && (
        <>
          <DualOrderChart start={startingBalance} returns={returns} />
          <p className="muted">
            Starting corpus {formatMoney(startingBalance, currency, locale)}. Forward end{" "}
            {formatMoney(result.forward, currency, locale)} vs reversed{" "}
            {formatMoney(result.reversed, currency, locale)}{" "}
            — sequencing gap {formatMoney(result.gap, currency, locale)}.
          </p>
        </>
      )}
    </section>
  );
}
