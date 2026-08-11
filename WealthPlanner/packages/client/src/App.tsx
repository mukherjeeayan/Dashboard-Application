import { useCallback, useEffect, useState } from "react";
import {
  api,
  runMonteCarloStream,
  type Plan,
  type UpdatePlanInput,
  type Account,
  type Goal,
  type JurisdictionPackSummary,
  type JurisdictionPack,
  type MonteCarloOutcome,
  type PortfolioRisk,
} from "./api";
import { FanChart } from "./FanChart";
import { PlanningPanel } from "./PlanningPanel";
import { ProjectionPanel } from "./ProjectionPanel";
import { SequenceRiskPanel } from "./SequenceRiskPanel";
import { WithdrawalStrategyPanel } from "./WithdrawalStrategyPanel";
import { SensitivityMatrixPanel } from "./SensitivityMatrixPanel";
import { ScenarioAnalysisPanel } from "./ScenarioAnalysisPanel";
import { ActionItemsPanel } from "./ActionItemsPanel";
import { TaxPanel } from "./TaxPanel";
import { HoldingsPanel } from "./HoldingsPanel";
import { ReconciliationPanel } from "./ReconciliationPanel";
import { EmergencyFundPanel } from "./EmergencyFundPanel";
import { AiInsightsPanel } from "./AiInsightsPanel";
import { Welcome } from "./Welcome";
import { formatMoney } from "./format";

const INSTRUMENT_OPTIONS = [
  "MARKET_LINKED_POOLED",
  "GOV_SAFE_LOCKED",
  "EMPLOYER_MANDATORY_LOCKED",
  "MARKET_LINKED_MULTI_SLEEVE",
  "EMPLOYER_DISCRETIONARY_LOCKED",
  "FIXED_TERM_DEPOSIT",
  "LIQUID_CASH",
  "MARKET_LINKED_DIRECT",
  "DIGITAL_ASSET",
];

const RISK_BUCKET_OPTIONS = ["EQUITY", "GOLD", "DEBT", "CASH"];

const DEFAULT_ASSUMPTIONS = {
  marketCagr: 0.12,
  marketVolatility: 0.2,
  stochasticMode: true,
  stochasticMethodology: "lognormal",
  inflationLongRunMean: 0.075,
  inflationMeanReversionSpeed: 0.2,
  inflationShockVolatility: 0.05,
  inflationFloor: 0,
  inflationCeiling: 0.15,
  glideStartEquity: 0.7,
  glideStep: 0.02,
  glideFloor: 0.3,
  lifestyleMultiplier: 1,
  withdrawalWaterfallEnabled: true,
  freezeRandomSeed: true,
  trialCount: 1000,
};

export default function App() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [packs, setPacks] = useState<JurisdictionPackSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [ownerName, setOwnerName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [targetRetirementDate, setTargetRetirementDate] = useState("");
  const [packId, setPackId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const refreshPlans = useCallback(async () => {
    try {
      setPlans(await api.listPlans());
    } catch (err) {
      console.error("Failed to load plans", err);
    }
  }, []);

  useEffect(() => {
    refreshPlans();
    api.listJurisdictionPacks().then(setPacks).catch(console.error);
  }, [refreshPlans]);

  const createPlan = async () => {
    setCreateError(null);
    if (!packId || !dateOfBirth || !targetRetirementDate) {
      setCreateError(
        "Please fill in date of birth, target retirement date, and a jurisdiction.",
      );
      return;
    }
    const pack = packs.find((p) => p.packId === packId);
    try {
      const created = await api.createPlan({
        ownerName: ownerName || undefined,
        dateOfBirth,
        targetRetirementDate,
        baseCurrency: pack?.currency ?? "INR",
        jurisdictionPackId: packId,
      });
      await refreshPlans();
      setSelectedId(created.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  };

  const selected = plans.find((p) => p.id === selectedId) ?? null;
  const selectedLocale =
    packs.find((p) => p.packId === selected?.jurisdictionPackId)?.locale ?? "en-IN";

  const updatePlan = async (id: string, input: UpdatePlanInput) => {
    await api.updatePlan(id, input);
    await refreshPlans();
  };

  const deletePlan = async (id: string) => {
    await api.deletePlan(id);
    if (selectedId === id) setSelectedId(null);
    await refreshPlans();
  };

  return (
    <div className="app">
      <aside className="app-sidebar">
        <h1 className="brand" aria-label="WealthPath">
          <span aria-hidden="true" className="brand-mark">W</span>
          WealthPath
        </h1>

        <div className="sidebar-section">
          <div className="sidebar-label">Your plans</div>
          <ul className="plan-list">
            {plans.map((p) => (
              <li key={p.id}>
                <button
                  className={selectedId === p.id ? "plan-btn active" : "plan-btn"}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span>{p.ownerName || p.jurisdictionPackId}</span>
                  <span className="plan-sub">{p.jurisdictionPackId} · {p.id.slice(0, 8)}</span>
                </button>
              </li>
            ))}
            {plans.length === 0 && <li className="hint">No plans yet.</li>}
          </ul>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">New plan</div>
          <div className="form-stack">
            <label className="field">
              Owner name
              <input className="input" placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </label>
            <label className="field">
              Date of birth
              <input className="input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </label>
            <label className="field">
              Target retirement
              <input className="input" type="date" value={targetRetirementDate} onChange={(e) => setTargetRetirementDate(e.target.value)} />
            </label>
            <label className="field">
              Jurisdiction pack
              <select className="input" value={packId} onChange={(e) => setPackId(e.target.value)}>
                <option value="">Jurisdiction…</option>
                {packs.map((p) => (
                  <option key={p.packId} value={p.packId}>
                    {p.displayName} ({p.packId})
                  </option>
                ))}
              </select>
            </label>
            <button onClick={createPlan} className="btn">
              Create plan
            </button>
            {createError && <p className="error" role="alert">{createError}</p>}
          </div>
        </div>
      </aside>

      <main className="app-main">
        {selected ? (
          <>
            <PlanManager
              key={selected.id}
              plan={selected}
              packs={packs}
              onUpdate={(input) => updatePlan(selected.id, input)}
              onDelete={() => deletePlan(selected.id)}
            />
            <PlanView
              planId={selected.id}
              baseCurrency={selected.baseCurrency}
              locale={selectedLocale}
              jurisdictionPackId={selected.jurisdictionPackId}
            />
          </>
        ) : (
          <Welcome packs={packs} />
        )}
      </main>
    </div>
  );
}

function PlanView({
  planId,
  baseCurrency,
  locale,
  jurisdictionPackId,
}: {
  planId: string;
  baseCurrency: string;
  locale: string;
  jurisdictionPackId: string;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [risk, setRisk] = useState<PortfolioRisk | null>(null);
  const [mc, setMc] = useState<MonteCarloOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-account form
  const [accLabel, setAccLabel] = useState("");
  const [accRuleKey, setAccRuleKey] = useState("");
  const [accBalance, setAccBalance] = useState("");
  const [accBucket, setAccBucket] = useState("");

  // Jurisdiction-driven instrument choices (docs/09 §9.3 step 4).
  const [pack, setPack] = useState<JurisdictionPack | null>(null);

  useEffect(() => {
    setPack(null);
    api.getJurisdictionPack(jurisdictionPackId).then(setPack).catch(console.error);
  }, [jurisdictionPackId]);

  // Assumptions / target allocation editor
  const [targetAlloc, setTargetAlloc] = useState<{ [k: string]: string }>({
    EQUITY: "",
    GOLD: "",
    DEBT: "",
    CASH: "",
  });
  const [assumptionMsg, setAssumptionMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>("overview");

  const load = useCallback(async () => {
    setMc(null);
    setRisk(null);
    setProgress(null);
    api.listAccounts(planId).then(setAccounts).catch(console.error);
    api.listGoals(planId).then(setGoals).catch(console.error);
    api.getPortfolioRisk(planId).then(setRisk).catch(console.error);
    api
      .getAssumptions(planId)
      .then((a) => {
        if (a.targetAllocationJson) {
          try {
            const parsed = JSON.parse(a.targetAllocationJson) as Record<string, number>;
            setTargetAlloc({
              EQUITY: String(Math.round((parsed.EQUITY ?? 0) * 100)),
              GOLD: String(Math.round((parsed.GOLD ?? 0) * 100)),
              DEBT: String(Math.round((parsed.DEBT ?? 0) * 100)),
              CASH: String(Math.round((parsed.CASH ?? 0) * 100)),
            });
          } catch {
            /* ignore malformed stored value */
          }
        }
      })
      .catch(console.error);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const netWorth = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  // Jurisdiction-driven instrument choices (docs/09 §9.3 step 4): prefer the
  // active pack's named instruments with their display labels, falling back to
  // the generic instrument-type list if the pack hasn't loaded.
  const instrumentChoices: Array<{ ruleKey: string; label: string; instrumentType: string }> =
    pack && Object.keys(pack.instrumentRules).length > 0
      ? Object.entries(pack.instrumentRules).map(([ruleKey, rule]) => ({
          ruleKey,
          label: rule.displayLabel ?? rule.instrumentType,
          instrumentType: rule.instrumentType,
        }))
      : INSTRUMENT_OPTIONS.map((t) => ({ ruleKey: t, label: t, instrumentType: t }));
  const effectiveRuleKey = accRuleKey || instrumentChoices[0]?.ruleKey || "";
  const selectedChoice = instrumentChoices.find((c) => c.ruleKey === effectiveRuleKey);

  const addAccount = async () => {
    const balance = Number(accBalance);
    if (!accLabel || !effectiveRuleKey || Number.isNaN(balance)) return;
    const bucketSplitJson = accBucket ? JSON.stringify({ [accBucket]: 1 }) : undefined;
    const choice = instrumentChoices.find((c) => c.ruleKey === effectiveRuleKey) ?? instrumentChoices[0];
    if (!choice) return;
    await api.createAccount(planId, {
      label: accLabel,
      instrumentType: choice.instrumentType,
      positionStructure: "single",
      liquidity: "liquid",
      jurisdictionRuleRef: choice.ruleKey,
      currency: baseCurrency,
      contributionRuleJson: "{}",
      roiRuleJson: "{}",
      currentBalance: balance,
      bucketSplitJson,
    });
    setAccLabel("");
    setAccBalance("");
    setAccBucket("");
    await load();
  };

  const saveTargetAllocation = async () => {
    setAssumptionMsg(null);
    const parsed: Record<string, number> = {};
    for (const bucket of RISK_BUCKET_OPTIONS) {
      const v = Number(targetAlloc[bucket]);
      if (!Number.isNaN(v) && v > 0) parsed[bucket] = v / 100;
    }
    const targetAllocationJson =
      Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : undefined;
    const existing = await api.getAssumptions(planId).catch(() => null);
    const body = { ...DEFAULT_ASSUMPTIONS, ...(existing ?? {}), targetAllocationJson };
    await api.putAssumptions(planId, body);
    setAssumptionMsg("Target allocation saved.");
    api.getPortfolioRisk(planId).then(setRisk).catch(console.error);
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    setProgress(null);
    try {
      const outcome = await runMonteCarloStream(
        planId,
        { trialCount: 1000, seed: 12345 },
        (p) => setProgress({ completed: p.completedTrials, total: p.totalTrials }),
      );
      setMc(outcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const pct =
    progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div>
      <div className="card-header" style={{ justifyContent: "flex-start", marginBottom: "0.25rem" }}>
        <h2 style={{ fontSize: "1.4rem" }}>Overview</h2>
      </div>
      <p className="hint">Plan {planId}</p>

      <nav className="tabbar" role="tablist" aria-label="Plan sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={activeTab === t.id ? "tab active" : "tab"}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <div className="stat-row">
            <Stat label="Net worth" value={formatMoney(netWorth, baseCurrency, locale)} />
            <Stat label="Accounts" value={String(accounts.length)} />
            <Stat label="Goals" value={String(goals.length)} />
            {mc && (
              <>
                <Stat label="Success probability" value={`${(mc.result.probabilityOfSuccess * 100).toFixed(1)}%`} />
                <Stat label="Median corpus" value={formatMoney(mc.result.median, baseCurrency, locale)} />
              </>
            )}
          </div>

          {risk && (
            <PortfolioRiskPanel risk={risk} currency={baseCurrency} locale={locale} />
          )}

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Monte Carlo simulation</h3>
              <button onClick={run} disabled={running} className="btn">
                {running ? `Running… ${progress ? `${pct}%` : ""}` : "Run Monte Carlo"}
              </button>
            </div>
            {running && progress && progress.total > 0 && (
              <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            )}
            {error && <p className="error">{error}</p>}
            {mc && (
              <div style={{ marginTop: "0.75rem" }}>
                <h3 style={{ marginBottom: "0.25rem" }}>Monte Carlo projection</h3>
                <FanChart curves={mc.result.curves} currency={baseCurrency} locale={locale} />
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "projection" && (
        <ProjectionPanel planId={planId} currency={baseCurrency} locale={locale} />
      )}

      {activeTab === "accounts" && (
        <>
          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Accounts</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Instrument</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.label}</td>
                    <td>{a.instrumentType}</td>
                    <td className="num">{formatMoney(a.currentBalance, baseCurrency, locale)}</td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No accounts yet. Add one below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <h4 style={{ margin: "1rem 0 0.5rem" }}>Add account</h4>
            <div className="row">
              <label className="field">
                Label
                <input className="input" placeholder="Label (e.g. Retirement fund)" value={accLabel} onChange={(e) => setAccLabel(e.target.value)} />
              </label>
              <label className="field">
                Instrument
                <select className="input" value={effectiveRuleKey} onChange={(e) => setAccRuleKey(e.target.value)}>
                  {instrumentChoices.map((c) => (
                    <option key={c.ruleKey} value={c.ruleKey}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Balance
                <input
                  className="input"
                  type="number"
                  placeholder="Balance"
                  value={accBalance}
                  onChange={(e) => setAccBalance(e.target.value)}
                  style={{ width: 140 }}
                />
              </label>
              <label className="field">
                Risk bucket
                <select className="input" value={accBucket} onChange={(e) => setAccBucket(e.target.value)}>
                  <option value="">Default (by instrument)</option>
                  {RISK_BUCKET_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={addAccount} className="btn">
                Add
              </button>
            </div>
            {selectedChoice && pack && (
              <p className="hint">
                Treats this as a {selectedChoice.instrumentType.replace(/_/g, " ")} account under{" "}
                {pack.displayName} rules.
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h3 className="card-title">Assumptions — target allocation (%)</h3>
              <span className="hint">{assumptionMsg}</span>
            </div>
            <div className="row">
              {RISK_BUCKET_OPTIONS.map((bucket) => (
                <label key={bucket} className="field">
                  {bucket}
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={targetAlloc[bucket]}
                    onChange={(e) => setTargetAlloc({ ...targetAlloc, [bucket]: e.target.value })}
                    style={{ width: 80 }}
                  />
                </label>
              ))}
              <button onClick={saveTargetAllocation} className="btn secondary">
                Save target allocation
              </button>
            </div>
          </section>

          {directAccounts(accounts).map((a) => (
            <HoldingsPanel
              key={a.id}
              planId={planId}
              accountId={a.id}
              label={a.label}
              currency={baseCurrency}
              locale={locale}
            />
          ))}
        </>
      )}

      {activeTab === "analysis" && (
        <>
          <SequenceRiskPanel planId={planId} currency={baseCurrency} locale={locale} />
          <WithdrawalStrategyPanel planId={planId} currency={baseCurrency} locale={locale} />
          <SensitivityMatrixPanel planId={planId} currency={baseCurrency} locale={locale} />
          <ScenarioAnalysisPanel planId={planId} currency={baseCurrency} locale={locale} />
        </>
      )}

      {activeTab === "planning" && (
        <PlanningPanel planId={planId} currency={baseCurrency} locale={locale} />
      )}

      {activeTab === "compliance" && (
        <>
          <TaxPanel planId={planId} currency={baseCurrency} locale={locale} />
          <ActionItemsPanel planId={planId} currency={baseCurrency} locale={locale} />
        </>
      )}

      {activeTab === "data" && (
        <>
          <ReconciliationPanel planId={planId} currency={baseCurrency} locale={locale} />
          <EmergencyFundPanel planId={planId} currency={baseCurrency} locale={locale} />
        </>
      )}

      {activeTab === "insights" && (
        <AiInsightsPanel planId={planId} locale={locale} />
      )}
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "projection", label: "Projection" },
  { id: "accounts", label: "Accounts & Holdings" },
  { id: "analysis", label: "Risk Analysis" },
  { id: "planning", label: "Planning" },
  { id: "compliance", label: "Tax & Compliance" },
  { id: "data", label: "Reconciliation" },
  { id: "insights", label: "AI Insights" },
];

const directAccounts = (
  accounts: Account[],
): Array<{ id: string; label: string }> =>
  accounts
    .filter((a) => a.instrumentType === "MARKET_LINKED_DIRECT" || a.instrumentType === "DIGITAL_ASSET")
    .map((a) => ({ id: a.id, label: a.label }));

function PortfolioRiskPanel({
  risk,
  currency,
  locale,
}: {
  risk: PortfolioRisk;
  currency: string;
  locale: string;
}) {
  const fmt = (v: number) => formatMoney(v, currency, locale);

  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Portfolio Risk</h3>
      </div>
      <div className="stat-row" style={{ marginBottom: "0.75rem" }}>
        <Stat label="Volatility" value={`${(risk.volatility * 100).toFixed(1)}%`} />
        <Stat label="Concentration (HHI)" value={risk.hhi.toFixed(3)} />
        <Stat label="Total value" value={fmt(risk.totalValue)} />
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Bucket</th>
            <th className="num">Current</th>
            <th className="num">Current %</th>
            <th className="num">Target %</th>
            <th className="num">Rebalance</th>
          </tr>
        </thead>
        <tbody>
          {risk.buckets.map((b) => (
            <tr key={b.bucket}>
              <td>{b.label}</td>
              <td className="num">{fmt(b.currentValue)}</td>
              <td className="num">{(b.currentWeight * 100).toFixed(1)}%</td>
              <td className="num">{(b.targetWeight * 100).toFixed(1)}%</td>
              <td className="num">{fmt(b.rebalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!risk.hasTarget && (
        <p className="hint">
          No target allocation set yet — rebalancing is shown relative to your current mix. Set{" "}
          <code>targetAllocationJson</code> on the plan's assumptions to enable buy/sell suggestions.
        </p>
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

function PlanManager({
  plan,
  packs,
  onUpdate,
  onDelete,
}: {
  plan: Plan;
  packs: JurisdictionPackSummary[];
  onUpdate: (input: UpdatePlanInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [ownerName, setOwnerName] = useState(plan.ownerName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(plan.dateOfBirth);
  const [targetRetirementDate, setTargetRetirementDate] = useState(
    plan.targetRetirementDate,
  );
  const [packId, setPackId] = useState(plan.jurisdictionPackId);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const startEdit = () => {
    setOwnerName(plan.ownerName ?? "");
    setDateOfBirth(plan.dateOfBirth);
    setTargetRetirementDate(plan.targetRetirementDate);
    setPackId(plan.jurisdictionPackId);
    setMsg(null);
    setErr(null);
    setEditing(true);
  };

  const save = async () => {
    setErr(null);
    setMsg(null);
    if (!dateOfBirth || !targetRetirementDate || !packId) {
      setErr("Please fill in date of birth, target retirement date, and a jurisdiction.");
      return;
    }
    const pack = packs.find((p) => p.packId === packId);
    try {
      await onUpdate({
        ownerName: ownerName || undefined,
        dateOfBirth,
        targetRetirementDate,
        baseCurrency: pack?.currency ?? plan.baseCurrency,
        jurisdictionPackId: packId,
      });
      setEditing(false);
      setMsg("Plan updated.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    setErr(null);
    setMsg(null);
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      await onDelete();
    } catch (e) {
      setConfirming(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="card plan-manager">
      <div className="card-header">
        <span className="card-title">Plan</span>
        <div className="row" style={{ gap: "0.4rem" }}>
          {!editing && (
            <button onClick={startEdit} className="btn sm secondary">
              Edit plan
            </button>
          )}
          <button
            onClick={remove}
            className={confirming ? "btn sm danger" : "btn sm secondary"}
          >
            {confirming ? "Confirm delete?" : "Delete plan"}
          </button>
        </div>
      </div>

      {msg && <p className="success">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}

      {editing ? (
        <>
          <div className="row">
            <label className="field">
              Owner name
              <input className="input" placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </label>
            <label className="field">
              Date of birth
              <input className="input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </label>
            <label className="field">
              Target retirement
              <input className="input" type="date" value={targetRetirementDate} onChange={(e) => setTargetRetirementDate(e.target.value)} />
            </label>
            <label className="field">
              Jurisdiction pack
              <select className="input" value={packId} onChange={(e) => setPackId(e.target.value)}>
                {packs.map((p) => (
                  <option key={p.packId} value={p.packId}>
                    {p.displayName} ({p.packId})
                  </option>
                ))}
              </select>
            </label>
            <button onClick={save} className="btn">Save changes</button>
            <button onClick={() => setEditing(false)} className="btn secondary">Cancel</button>
          </div>
        </>
      ) : (
        <p className="muted">
          {plan.ownerName || "Unnamed plan"} · {plan.jurisdictionPackId} · DOB{" "}
          {plan.dateOfBirth} · retirement {plan.targetRetirementDate}
        </p>
      )}
    </section>
  );
}


