// Post-tax drawdown analysis (docs/09 "Tax", source §3.3.4/§3.12). Builds a
// sleeve map from the plan's accounts, then compares a systematic withdrawal
// plan (SWP: one annual draw for a year of retirement spend) against a single
// lump-sum withdrawal, reporting the post-tax retention ratio and net proceeds
// for each, using the same data-driven waterfall tax logic as the projection.

import { eq } from "drizzle-orm";
import { runWithdrawalWaterfall, type SleeveMap } from "@wealthpath/engine";
import { loadPack } from "@wealthpath/jurisdictions";
import type { Db } from "./db";
import { plans, accounts, majorExpenses } from "./db/schema";

export interface TaxAnalysisResult {
  planId: string;
  totalCorpus: number;
  /** Post-tax retention ratio (net / gross) for a single annual SWP draw. */
  swpRetentionRatio: number;
  swp: { gross: number; tax: number; net: number };
  /** Post-tax retention ratio for a single lump-sum withdrawal of the corpus. */
  lumpSumRetentionRatio: number;
  lumpSum: { gross: number; tax: number; net: number };
  /** Recommendation label comparing the two. */
  verdict: string;
}

function isLocked(liquidity: string): boolean {
  return /locked/i.test(liquidity);
}

/** Builds a sleeve map (by InstrumentType) from the plan's accounts. */
function buildSleeves(
  db: Db,
  planId: string,
): { sleeves: SleeveMap; totalCorpus: number } {
  const planAccounts = db.select().from(accounts).where(eq(accounts.planId, planId)).all();
  const sleeves: SleeveMap = {};
  let totalCorpus = 0;
  for (const account of planAccounts) {
    const balance = account.currentBalance ?? 0;
    totalCorpus += balance;
    const existing = sleeves[account.instrumentType] ?? { balance: 0, unlocked: false };
    existing.balance += balance;
    existing.unlocked = !isLocked(account.liquidity);
    sleeves[account.instrumentType] = existing;
  }
  return { sleeves, totalCorpus };
}

export function projectTaxAnalysis(db: Db, planId: string): TaxAnalysisResult | null {
  const [plan] = db.select().from(plans).where(eq(plans.id, planId)).limit(1).all();
  if (!plan) return null;

  const { sleeves, totalCorpus } = buildSleeves(db, planId);
  const pack = loadPack(plan.jurisdictionPackId);

  // Annual retirement spend: the plan's first major expense (as in projection).
  const [firstExpense] = db
    .select()
    .from(majorExpenses)
    .where(eq(majorExpenses.planId, planId))
    .orderBy(majorExpenses.year)
    .limit(1)
    .all();
  const annualSpend = firstExpense?.amountTodayValue ?? 0;

  // SWP: a single annual draw of the retirement spend.
  const swpResult = runWithdrawalWaterfall(annualSpend, { ...sleeves }, pack);
  const swpGross = swpResult.draws.reduce((s, d) => s + d.draw, 0);
  const swpTax = swpResult.draws.reduce((s, d) => s + d.tax, 0);
  const swpNet = swpResult.draws.reduce((s, d) => s + d.net, 0);

  // Lump-sum: withdraw the whole corpus at once.
  const lumpSumResult = runWithdrawalWaterfall(totalCorpus, { ...sleeves }, pack);
  const lumpGross = lumpSumResult.draws.reduce((s, d) => s + d.draw, 0);
  const lumpTax = lumpSumResult.draws.reduce((s, d) => s + d.tax, 0);
  const lumpNet = lumpSumResult.draws.reduce((s, d) => s + d.net, 0);

  const swpRetentionRatio = swpGross > 0 ? swpNet / swpGross : 0;
  const lumpSumRetentionRatio = lumpGross > 0 ? lumpNet / lumpGross : 0;

  const verdict =
    swpRetentionRatio >= lumpSumRetentionRatio
      ? "Systematic withdrawals preserve more post-tax corpus than a lump-sum draw."
      : "A lump-sum draw preserves a higher post-tax ratio for this plan.";

  return {
    planId,
    totalCorpus,
    swpRetentionRatio,
    swp: { gross: swpGross, tax: swpTax, net: swpNet },
    lumpSumRetentionRatio,
    lumpSum: { gross: lumpGross, tax: lumpTax, net: lumpNet },
    verdict,
  };
}
