// Builds the minimal, disclosed context payload for each insight type
// (docs/16 §16.6). Only numbers already shown on the triggering screen are
// included — never names, account numbers, or holder PII beyond what the
// numbers themselves imply. These payloads are what the confirmation dialog
// shows as "what gets sent" and what the prompt templates JSON-serialize.

import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { accounts, goals, plans } from "../db/schema";
import type { InsightType } from "./promptTemplates";

/** Context builders keyed by insight type. Each returns a plain object. */
export async function buildInsightContext(
  db: Db,
  planId: string,
  type: InsightType,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [plan] = db.select().from(plans).where(eq(plans.id, planId)).limit(1).all();
  if (!plan) throw new Error("Plan not found.");

  const base = {
    baseCurrency: plan.baseCurrency,
    jurisdictionPackId: plan.jurisdictionPackId,
    targetRetirementDate: plan.targetRetirementDate,
  };

  switch (type) {
    case "PLAN_SUMMARY": {
      const planAccounts = db.select().from(accounts).where(eq(accounts.planId, planId)).all();
      const total = planAccounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0);
      return { ...base, totalCorpus: total, accountCount: planAccounts.length };
    }
    case "MONTE_CARLO_INTERPRETATION": {
      // The run summary is passed as the trigger's extra payload (server route
      // forwards the already-computed run result to keep this read-only).
      return { ...base, run: extra?.run ?? null };
    }
    case "SENSITIVITY_SCENARIO_EXPLANATION": {
      return { ...base, sensitivity: extra?.sensitivity ?? null, scenario: extra?.scenario ?? null };
    }
    case "GOAL_PROGRESS_NARRATIVE": {
      const planGoals = db.select().from(goals).where(eq(goals.planId, planId)).all();
      return {
        ...base,
        goals: planGoals.map((g) => ({
          label: g.label,
          costToday: g.costToday,
          currentSavingsEarmarked: g.currentSavingsEarmarked ?? 0,
          targetYear: g.targetYear ?? null,
        })),
      };
    }
    case "ACTION_ITEMS_PRIORITIZATION": {
      return { ...base, actionItems: extra?.actionItems ?? [] };
    }
  }
}
