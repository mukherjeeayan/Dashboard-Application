// Automation (docs/06 §6.8, source §3.16): deadlines, data health,
// rule consistency, and the aggregated action-items list. All jurisdiction-
// independent date/threshold logic, generalized by the plan's fiscal-year
// convention.

export type DeadlineKind =
  | "LOCKED_EXTENSION"
  | "MANDATORY_EXIT"
  | "LOAN_PAYOFF"
  | "TERM_DEPOSIT_MATURITY"
  | "INSURANCE_RENEWAL";

export interface Deadline {
  kind: DeadlineKind;
  label: string;
  date: string;
}

export interface DeadlineSource {
  accounts?: { label: string; kind: "LOCKED_EXTENSION" | "MANDATORY_EXIT"; date: string }[];
  loans?: { label: string; payoffDate: string }[];
  termDeposits?: { label: string; maturityDate: string }[];
  insurance?: { label: string; renewalDate: string }[];
}

/** Auto-generates one deadline entry per record (docs/06 §6.8). */
export function generateDeadlines(source: DeadlineSource): Deadline[] {
  const out: Deadline[] = [];
  for (const a of source.accounts ?? []) {
    out.push({ kind: a.kind, label: a.label, date: a.date });
  }
  for (const l of source.loans ?? []) {
    out.push({ kind: "LOAN_PAYOFF", label: l.label, date: l.payoffDate });
  }
  for (const t of source.termDeposits ?? []) {
    out.push({ kind: "TERM_DEPOSIT_MATURITY", label: t.label, date: t.maturityDate });
  }
  for (const i of source.insurance ?? []) {
    out.push({ kind: "INSURANCE_RENEWAL", label: i.label, date: i.renewalDate });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Data health: flags accounts with stale reconciliation data. */
export function dataHealth(
  accounts: { label: string; lastUpdated: string | null }[],
  maxAgeDays: number,
  now: string,
): { account: string; stale: boolean; ageDays: number }[] {
  const nowMs = new Date(now).getTime();
  return accounts.map((a) => {
    const ageDays = a.lastUpdated ? (nowMs - new Date(a.lastUpdated).getTime()) / 86_400_000 : Infinity;
    return { account: a.label, stale: ageDays > maxAgeDays, ageDays };
  });
}

/**
 * Rule-derived consistency check (docs/06 §6.8, docs/14 G4): compares a value
 * derived from first principles (e.g. expected maturity year) with the value
 * actually used, flagging OK/CHECK.
 */
export function ruleConsistency(
  checks: { label: string; derived: number; used: number }[],
): { label: string; status: "OK" | "CHECK"; derived: number; used: number }[] {
  return checks.map((c) => ({
    label: c.label,
    status: c.derived === c.used ? "OK" : "CHECK",
    derived: c.derived,
    used: c.used,
  }));
}

export type ActionSeverity = "OK" | "WARN" | "CRITICAL";

export interface ActionItem {
  id: string;
  message: string;
  severity: ActionSeverity;
  source: string;
}

/**
 * Aggregates flags from every module into a single action-items checklist
 * (docs/06 §6.8). Sources are passed as pre-computed flag arrays so the engine
 * stays pure and testable.
 */
export function buildActionItems(sources: ActionItem[][]): ActionItem[] {
  const flat = sources.flat();
  const seen = new Set<string>();
  const unique = flat.filter((i) => {
    const key = `${i.source}:${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rank = { CRITICAL: 0, WARN: 1, OK: 2 };
  return unique.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
