// Welcome / first-run screen (docs/09 §9.3 step 1–2). Shown when no plan has
// been created yet: it explains the setup flow and points the user at the
// jurisdiction selection in the sidebar. Jurisdiction packs available today are
// listed so the user knows what's on offer.

import type { JurisdictionPackSummary } from "./api";

export function Welcome({ packs }: { packs: JurisdictionPackSummary[] }) {
  return (
    <section className="welcome">
      <h2>Welcome to WealthPath</h2>
      <p>
        Plan your retirement and wealth in a jurisdiction-aware way. Every plan
        you create is shaped by the tax and savings rules of the jurisdiction you
        choose — set it once, and all the defaults, labels, and projections follow.
      </p>

      <ol className="welcome-steps">
        {[
          <>
            Pick a <strong>jurisdiction</strong> from the dropdown in the sidebar.
          </>,
          <>
            Enter your <strong>date of birth</strong> and target retirement date.
          </>,
          <>Create the plan, then add your first account.</>,
        ].map((step, i) => (
          <li key={i} className="step">
            <span className="step-num">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="hint" style={{ marginBottom: "0.5rem" }}>
        Available jurisdictions
      </p>
      {packs.length === 0 ? (
        <p className="hint">No jurisdiction packs installed.</p>
      ) : (
        <div className="pack-list">
          {packs.map((p) => (
            <span key={p.packId} className="pack-chip">
              {p.displayName} ({p.packId}) — {p.currency}
            </span>
          ))}
        </div>
      )}

      <p className="hint">
        All data stays on your device — no account you type is ever sent anywhere.
      </p>
    </section>
  );
}
