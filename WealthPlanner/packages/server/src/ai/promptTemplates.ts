// One prompt template per insight type (docs/16 §16.5). Every insight is
// generated purely from already-computed WealthPath output; the LLM is never
// asked to perform arithmetic. Output must be advisory narrative, never a
// directive to buy/sell/contribute (§16.1 point 5).

export type InsightType =
  | "PLAN_SUMMARY"
  | "MONTE_CARLO_INTERPRETATION"
  | "SENSITIVITY_SCENARIO_EXPLANATION"
  | "GOAL_PROGRESS_NARRATIVE"
  | "ACTION_ITEMS_PRIORITIZATION";

const SYSTEM_BASE =
  "You are a helpful, conservative personal-finance explainer embedded in a " +
  "local-first retirement planner. You receive already-computed numbers only. " +
  "Do NOT recompute or verify arithmetic. Write a few plain-language paragraphs " +
  "that EXPLAIN and CONTEXTUALIZE the numbers. Never issue a buy/sell/contribute " +
  "instruction as if it were advice from the app, never promise returns, and " +
  "remind that this is general commentary, not personalized financial advice.";

export function buildSystemPrompt(type: InsightType): string {
  switch (type) {
    case "PLAN_SUMMARY":
      return `${SYSTEM_BASE} Summarize the plan's current net worth and portfolio risk posture in plain language.`;
    case "MONTE_CARLO_INTERPRETATION":
      return `${SYSTEM_BASE} Explain what the probability-of-success figure and the P10/P50/P90 corpus spread practically mean for this plan.`;
    case "SENSITIVITY_SCENARIO_EXPLANATION":
      return `${SYSTEM_BASE} Narrate which assumptions the plan is most sensitive to and why, based only on the provided grid/scenario numbers.`;
    case "GOAL_PROGRESS_NARRATIVE":
      return `${SYSTEM_BASE} Summarize which goals are on-track versus short-falling and by roughly how much.`;
    case "ACTION_ITEMS_PRIORITIZATION":
      return `${SYSTEM_BASE} Suggest a reasonable order to tackle the provided action items, treating them as existing flags to prioritize — do not invent new ones.`;
  }
}

/**
 * Builds the exact user message (and thereby the disclosed payload) for an
 * insight type from an already-built context object. Context objects are
 * constructed in insightService per type, with only the numbers shown on the
 * triggering screen.
 */
export function buildUserPrompt(type: InsightType, context: unknown): string {
  return JSON.stringify({ insightType: type, context }, null, 2);
}
