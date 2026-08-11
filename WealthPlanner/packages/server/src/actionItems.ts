// Action Items & Deadlines (docs/06 §6.8, source §3.16). Maps stored accounts,
// liabilities, and term deposits into the engine's pure automation functions
// (deadlines, data health, action items) and returns the aggregated checklist.

import { eq, inArray } from "drizzle-orm";
import {
  generateDeadlines,
  dataHealth,
  buildActionItems,
  type ActionItem,
  type Deadline,
} from "@wealthpath/engine";
import type { Db } from "./db";
import {
  plans,
  accounts,
  liabilities,
  insurancePolicies,
  termDepositPositions,
  majorExpenses,
} from "./db/schema";

export interface ActionItemsResult {
  planId: string;
  deadlines: Deadline[];
  health: { account: string; stale: boolean; ageDays: number }[];
  actionItems: ActionItem[];
}

const STALE_THRESHOLD_DAYS = 180;
const NOW = new Date().toISOString();

/** Computes a loan's payoff date from its start date + tenure (months). */
function payoffDate(startDate: string, tenureMonths: number): string {
  const d = new Date(startDate);
  d.setUTCMonth(d.getUTCMonth() + tenureMonths);
  return d.toISOString().slice(0, 10);
}

/** Flags an account as having a locked-extension deadline when it's locked. */
function lockedExtension(account: { label: string; liquidity: string; lastUpdated: string | null }): {
  label: string;
  kind: "LOCKED_EXTENSION" | "MANDATORY_EXIT";
  date: string;
} | null {
  if (!/locked/i.test(account.liquidity)) return null;
  const date = account.lastUpdated ?? NOW.slice(0, 10);
  return { label: account.label, kind: "LOCKED_EXTENSION", date };
}

export function buildActionItemsForPlan(db: Db, planId: string): ActionItemsResult | null {
  const [plan] = db.select().from(plans).where(eq(plans.id, planId)).limit(1).all();
  if (!plan) return null;

  const planAccounts = db.select().from(accounts).where(eq(accounts.planId, planId)).all();
  const planLiabilities = db.select().from(liabilities).where(eq(liabilities.planId, planId)).all();
  const planInsurance = db.select().from(insurancePolicies).where(eq(insurancePolicies.planId, planId)).all();
  const planAccountIds = planAccounts.map((a) => a.id);
  const planTermDeposits =
    planAccountIds.length > 0
      ? db
          .select()
          .from(termDepositPositions)
          .where(inArray(termDepositPositions.accountId, planAccountIds))
          .all()
      : [];
  const planExpenses = db.select().from(majorExpenses).where(eq(majorExpenses.planId, planId)).all();

  const deadlines = generateDeadlines({
    accounts: planAccounts.flatMap((a) => lockedExtension(a) ?? []),
    loans: planLiabilities.map((l) => ({ label: l.label, payoffDate: payoffDate(l.startDate, l.tenureMonths) })),
    termDeposits: planTermDeposits.map((t) => ({ label: "Term deposit", maturityDate: t.maturityDate })),
  });

  const health = dataHealth(
    planAccounts.map((a) => ({ label: a.label, lastUpdated: a.lastUpdated ?? null })),
    STALE_THRESHOLD_DAYS,
    NOW,
  );

  const actionItems = buildActionItems([
    deadlines.map(
      (d): ActionItem => ({
        id: `dl-${d.kind}-${d.label}`,
        message: `Deadline ${d.kind}: ${d.label} on ${d.date}`,
        severity: new Date(d.date) < new Date(NOW) ? "CRITICAL" : "WARN",
        source: "deadline",
      }),
    ),
    health
      .filter((h) => h.stale)
      .map(
        (h): ActionItem => ({
          id: `health-${h.account}`,
          message: `Reconcile ${h.account}: last updated ${h.ageDays.toFixed(0)} days ago`,
          severity: "WARN",
          source: "data-health",
        }),
      ),
    planInsurance.map(
      (p): ActionItem => ({
        id: `insurance-${p.id}`,
        message: `Review ${p.type} cover of ${p.coverInForce}`,
        severity: "OK",
        source: "insurance",
      }),
    ),
    planExpenses.length === 0
      ? [
          {
            id: "expense-missing",
            message: "Add a retirement major expense to drive projection draws",
            severity: "WARN",
            source: "expense",
          } as ActionItem,
        ]
      : [],
  ]);

  return { planId, deadlines, health, actionItems };
}
