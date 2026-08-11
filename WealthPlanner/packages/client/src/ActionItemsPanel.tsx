// Action Items & Deadlines screen (docs/09, "Action Items"). Read-only
// aggregation of auto-generated deadlines, account data-health flags, and a
// severity-ranked action-item checklist from the server.

import { useEffect, useState } from "react";
import { api, type ActionItems } from "./api";

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#c00",
  WARN: "#8a5a00",
  OK: "#1a7f37",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function ActionItemsPanel({
  planId,
}: {
  planId: string;
  currency?: string;
  locale?: string;
}) {
  const [data, setData] = useState<ActionItems | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .getActionItems(planId)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [planId]);

  if (error) {
    return (
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Action Items</h3>
        </div>
        <p className="error">Could not load action items: {error}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Action Items</h3>
      </div>
      {!data ? (
        <p className="muted">Loading action items…</p>
      ) : (
        <>
          <h4>Upcoming deadlines</h4>
          {data.deadlines.length === 0 ? (
            <p className="muted">
              No deadlines yet. Locked accounts, loans, and term deposits produce them.
            </p>
          ) : (
            <ul className="plain-list">
              {data.deadlines.map((d) => (
                <li key={`${d.kind}-${d.label}`}>
                  {d.label} — {fmtDate(d.date)}
                </li>
              ))}
            </ul>
          )}

          <h4 style={{ marginTop: "0.75rem" }}>Checklist</h4>
          {data.actionItems.length === 0 ? (
            <p className="muted">All clear.</p>
          ) : (
            <ul className="plain-list">
              {data.actionItems.map((a) => (
                <li key={a.id} style={{ color: SEVERITY_COLOR[a.severity] }}>
                  {a.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
