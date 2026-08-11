// Planning screen (docs/09, "Goals, Liabilities, Insurance, Major Expenses").
// Four CRUD sub-sections, each a compact add-form + list, wired to the existing
// server routes. All read-write (Setup/Planning screens are input forms).

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type Goal,
  type Liability,
  type InsurancePolicy,
  type MajorExpense,
} from "./api";
import { formatMoney } from "./format";

function num(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="row">{children}</div>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  width,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  width?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
      />
    </label>
  );
}

function Section({
  title,
  add,
  children,
}: {
  title: string;
  add: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
      </div>
      <Row>{add}</Row>
      {children}
    </section>
  );
}

export function PlanningPanel({
  planId,
  currency,
  locale = "en-IN",
}: {
  planId: string;
  currency: string;
  locale?: string;
}) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [insurance, setInsurance] = useState<InsurancePolicy[]>([]);
  const [expenses, setExpenses] = useState<MajorExpense[]>([]);

  // Goal form
  const [gLabel, setGLabel] = useState("");
  const [gCost, setGCost] = useState("");
  const [gRate, setGRate] = useState("");
  const [gRoi, setGRoi] = useState("");
  const [gYear, setGYear] = useState("");

  // Liability form
  const [lLabel, setLLabel] = useState("");
  const [lPrincipal, setLPrincipal] = useState("");
  const [lRate, setLRate] = useState("");
  const [lTenure, setLTenure] = useState("");
  const [lStart, setLStart] = useState("");

  // Insurance form
  const [iType, setIType] = useState("");
  const [iCover, setICover] = useState("");
  const [iIncome, setIIncome] = useState("");
  const [iFamily, setIFamily] = useState("");

  // Expense form
  const [eYear, setEYear] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eAmount, setEAmount] = useState("");

  const load = useCallback(async () => {
    api.listGoals(planId).then(setGoals).catch(console.error);
    api.listLiabilities(planId).then(setLiabilities).catch(console.error);
    api.listInsurance(planId).then(setInsurance).catch(console.error);
    api.listExpenses(planId).then(setExpenses).catch(console.error);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const addGoal = async () => {
    if (!gLabel) return;
    const cost = num(gCost);
    if (cost === null) return;
    await api.createGoal(planId, {
      label: gLabel,
      costToday: cost,
      costInflationRate: num(gRate) ?? 0,
      expectedRoi: num(gRoi) ?? 0,
      targetYear: num(gYear),
    });
    setGLabel("");
    setGCost("");
    setGRate("");
    setGRoi("");
    setGYear("");
    await load();
  };

  const addLiability = async () => {
    if (!lLabel) return;
    const principal = num(lPrincipal);
    const tenure = num(lTenure);
    if (principal === null || tenure === null) return;
    await api.createLiability(planId, {
      label: lLabel,
      principal,
      rate: num(lRate) ?? 0,
      tenureMonths: tenure,
      startDate: lStart || new Date().toISOString().slice(0, 10),
    });
    setLLabel("");
    setLPrincipal("");
    setLRate("");
    setLTenure("");
    setLStart("");
    await load();
  };

  const addInsurance = async () => {
    if (!iType) return;
    const cover = num(iCover);
    if (cover === null) return;
    await api.createInsurance(planId, {
      type: iType,
      coverInForce: cover,
      annualIncome: num(iIncome) ?? 0,
      familySize: num(iFamily) ?? 1,
    });
    setIType("");
    setICover("");
    setIIncome("");
    setIFamily("");
    await load();
  };

  const addExpense = async () => {
    if (!eDesc) return;
    const amount = num(eAmount);
    const year = num(eYear);
    if (amount === null || year === null) return;
    await api.createExpense(planId, {
      year,
      description: eDesc,
      amountTodayValue: amount,
    });
    setEDesc("");
    setEAmount("");
    setEYear("");
    await load();
  };

  return (
    <div>
      <Section
        title="Goals"
        add={
          <>
            <Field label="Goal label" value={gLabel} onChange={setGLabel} placeholder="Retire in Goa" />
            <Field label="Goal cost today" value={gCost} onChange={setGCost} type="number" width={110} />
            <Field label="Goal inflation %" value={gRate} onChange={setGRate} type="number" width={90} />
            <Field label="Goal ROI %" value={gRoi} onChange={setGRoi} type="number" width={110} />
            <Field label="Target year" value={gYear} onChange={setGYear} type="number" width={90} />
            <button onClick={addGoal} className="btn">
              Add goal
            </button>
          </>
        }
      >
        {goals.length === 0 ? (
          <p className="muted">No goals yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Label</th>
                <th className="num">Cost today</th>
                <th className="num">Target year</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.id}>
                  <td>{g.label}</td>
                  <td className="num">{formatMoney(g.costToday, currency, locale)}</td>
                  <td className="num">{g.targetYear ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Liabilities"
        add={
          <>
            <Field label="Liability label" value={lLabel} onChange={setLLabel} placeholder="Home loan" />
            <Field label="Liability principal" value={lPrincipal} onChange={setLPrincipal} type="number" width={110} />
            <Field label="Liability rate %" value={lRate} onChange={setLRate} type="number" width={80} />
            <Field label="Tenure (months)" value={lTenure} onChange={setLTenure} type="number" width={110} />
            <Field label="Start date" value={lStart} onChange={setLStart} type="date" width={140} />
            <button onClick={addLiability} className="btn">
              Add liability
            </button>
          </>
        }
      >
        {liabilities.length === 0 ? (
          <p className="muted">No liabilities yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Label</th>
                <th className="num">Principal</th>
                <th className="num">Rate</th>
                <th className="num">Months</th>
              </tr>
            </thead>
            <tbody>
              {liabilities.map((l) => (
                <tr key={l.id}>
                  <td>{l.label}</td>
                  <td className="num">{formatMoney(l.principal, currency, locale)}</td>
                  <td className="num">{(l.rate * 100).toFixed(1)}%</td>
                  <td className="num">{l.tenureMonths}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Insurance"
        add={
          <>
            <Field label="Policy type" value={iType} onChange={setIType} placeholder="TERM" />
            <Field label="Cover in force" value={iCover} onChange={setICover} type="number" width={110} />
            <Field label="Annual income" value={iIncome} onChange={setIIncome} type="number" width={110} />
            <Field label="Family size" value={iFamily} onChange={setIFamily} type="number" width={80} />
            <button onClick={addInsurance} className="btn">
              Add policy
            </button>
          </>
        }
      >
        {insurance.length === 0 ? (
          <p className="muted">No insurance policies yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Cover</th>
                <th className="num">Income</th>
                <th className="num">Family</th>
              </tr>
            </thead>
            <tbody>
              {insurance.map((p) => (
                <tr key={p.id}>
                  <td>{p.type}</td>
                  <td className="num">{formatMoney(p.coverInForce, currency, locale)}</td>
                  <td className="num">{formatMoney(p.annualIncome, currency, locale)}</td>
                  <td className="num">{p.familySize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Major expenses"
        add={
          <>
            <Field label="Expense year" value={eYear} onChange={setEYear} type="number" width={90} />
            <Field label="Expense description" value={eDesc} onChange={setEDesc} placeholder="Child wedding" />
            <Field label="Expense amount today" value={eAmount} onChange={setEAmount} type="number" width={120} />
            <button onClick={addExpense} className="btn">
              Add expense
            </button>
          </>
        }
      >
        {expenses.length === 0 ? (
          <p className="muted">No major expenses yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Description</th>
                <th className="num">Amount today</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.year}</td>
                  <td>{e.description}</td>
                  <td className="num">{formatMoney(e.amountTodayValue, currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
