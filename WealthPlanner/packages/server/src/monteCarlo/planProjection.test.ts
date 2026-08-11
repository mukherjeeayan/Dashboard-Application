import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type Db } from "../db";
import { accounts, majorExpenses, planAssumptions, plans } from "../db/schema";
import { projectSingleBlended } from "./planProjection";

let db: Db;
let close: () => void;

beforeAll(() => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-proj-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  db.insert(plans)
    .values({
      id: "plan-1",
      dateOfBirth: "1986-01-01",
      targetRetirementDate: "2067-01-01",
      baseCurrency: "INR",
      jurisdictionPackId: "IN-2025",
      createdAt: "2026-01-01T00:00:00Z",
    })
    .run();

  db.insert(planAssumptions)
    .values({
      planId: "plan-1",
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
      rngSeed: 7,
      trialCount: 500,
    })
    .run();

  // One fixed-income account (term deposit) and one market account (equity MF).
  db.insert(accounts)
    .values([
      {
        id: "acc-fixed",
        planId: "plan-1",
        label: "FD",
        instrumentType: "FIXED_TERM_DEPOSIT",
        positionStructure: "single",
        liquidity: "locked",
        jurisdictionRuleRef: "FIXED_TERM_DEPOSIT",
        currency: "INR",
        contributionRuleJson: "{}",
        roiRuleJson: "{}",
        currentBalance: 10_000,
      },
      {
        id: "acc-market",
        planId: "plan-1",
        label: "MF",
        instrumentType: "MARKET_LINKED_POOLED",
        positionStructure: "lots",
        liquidity: "marketable",
        jurisdictionRuleRef: "MARKET_LINKED_POOLED",
        currency: "INR",
        contributionRuleJson: "{}",
        roiRuleJson: "{}",
        currentBalance: 90_000,
      },
    ])
    .run();

  db.insert(majorExpenses)
    .values({ id: "exp-1", planId: "plan-1", year: 0, description: "retirement", amountTodayValue: 50_000 })
    .run();
});

afterAll(() => close());

describe("projectSingleBlended", () => {
  it("aggregates accounts into fixed-income and market sleeves", () => {
    const p = projectSingleBlended(db, "plan-1")!;
    expect(p.fixedIncomeSleeve).toBe(10_000);
    expect(p.marketSleeve).toBe(90_000);
  });

  it("derives expenditure from the first major expense", () => {
    expect(projectSingleBlended(db, "plan-1")!.yearlyExpenditure).toBe(50_000);
  });

  it("derives market params, seed and trialCount from plan assumptions", () => {
    const p = projectSingleBlended(db, "plan-1")!;
    expect(p.marketMean).toBe(0.12);
    expect(p.marketVol).toBe(0.2);
    expect(p.inflation).toBe(0.075);
    expect(p.trialCount).toBe(500);
    expect(p.seed).toBe(7);
  });

  it("derives the horizon from targetRetirementDate", () => {
    expect(projectSingleBlended(db, "plan-1")!.years).toBe(41);
  });

  it("lets overrides win over derived values", () => {
    const p = projectSingleBlended(db, "plan-1", { trialCount: 999, seed: null, marketMean: 0.15 })!;
    expect(p.trialCount).toBe(999);
    expect(p.marketMean).toBe(0.15);
    expect(p.seed).toBeUndefined();
  });

  it("returns null for a missing plan", () => {
    expect(projectSingleBlended(db, "nope")).toBeNull();
  });
});
