import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { openDb, type Db } from "./db";
import { registerApiRoutes } from "./api/routes";
import { projectPortfolioRisk } from "./portfolioRisk";

let db: Db;
let close: () => void;
let app: FastifyInstance;
let planId: string;

const PLAN = {
  ownerName: "Aya",
  dateOfBirth: "1986-05-10",
  targetRetirementDate: "2060-01-01",
  baseCurrency: "INR",
  jurisdictionPackId: "IN-2025",
};

const ASSUMPTIONS = {
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

function account(instrumentType: string, currentBalance: number) {
  return {
    label: instrumentType,
    instrumentType,
    positionStructure: "single",
    liquidity: "locked",
    jurisdictionRuleRef: instrumentType,
    currency: "INR",
    contributionRuleJson: "{}",
    roiRuleJson: "{}",
    currentBalance,
  };
}

beforeAll(async () => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-risk-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db);
  await app.ready();

  const created = await app.inject({ method: "POST", url: "/plans", payload: PLAN });
  planId = created.json().id;
});

afterAll(async () => {
  await app.close();
  close();
});

describe("portfolioRisk projection", () => {
  it("returns null for a missing plan", () => {
    expect(projectPortfolioRisk(db, { planId: "ghost" })).toBeNull();
  });

  it("maps accounts into buckets and computes metrics", async () => {
    await app.inject({
      method: "POST",
      url: `/plans/${planId}/accounts`,
      payload: account("FIXED_TERM_DEPOSIT", 300_000), // DEBT
    });
    await app.inject({
      method: "POST",
      url: `/plans/${planId}/accounts`,
      payload: account("MARKET_LINKED_POOLED", 700_000), // EQUITY
    });

    const res = await app.inject({ method: "GET", url: `/plans/${planId}/portfolio-risk` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.totalValue).toBe(1_000_000);
    expect(body.hasTarget).toBe(false); // no assumptions target yet

    const debt = body.buckets.find((b: { bucket: string }) => b.bucket === "DEBT");
    const equity = body.buckets.find((b: { bucket: string }) => b.bucket === "EQUITY");
    expect(debt.currentValue).toBe(300_000);
    expect(equity.currentValue).toBe(700_000);
    expect(debt.currentWeight).toBeCloseTo(0.3, 9);
    expect(equity.currentWeight).toBeCloseTo(0.7, 9);

    // No explicit target → rebalance is zero and HHI reflects concentration.
    expect(debt.rebalance).toBeCloseTo(0, 9);
    expect(body.hhi).toBeCloseTo(0.3 ** 2 + 0.7 ** 2, 9);
    expect(body.volatility).toBeGreaterThan(0);
  });

  it("uses a stored assumptions target allocation for rebalancing", async () => {
    await app.inject({
      method: "PUT",
      url: `/plans/${planId}/assumptions`,
      payload: {
        ...ASSUMPTIONS,
        targetAllocationJson: JSON.stringify({ EQUITY: 0.5, DEBT: 0.5 }),
      },
    });

    const res = await app.inject({ method: "GET", url: `/plans/${planId}/portfolio-risk` });
    const body = res.json();
    expect(body.hasTarget).toBe(true);

    const equity = body.buckets.find((b: { bucket: string }) => b.bucket === "EQUITY");
    const debt = body.buckets.find((b: { bucket: string }) => b.bucket === "DEBT");
    // current 70/30 vs target 50/50 on total 1_000_000
    expect(equity.rebalance).toBeCloseTo(0.5 * 1_000_000 - 700_000, 6); // -200_000 → sell
    expect(debt.rebalance).toBeCloseTo(0.5 * 1_000_000 - 300_000, 6); // +200_000 → buy
  });

  it("honors a per-account bucket split", async () => {
    const created = await app.inject({ method: "POST", url: "/plans", payload: PLAN });
    const pid = created.json().id;

    // A DEBT-type sleeve that is 75% equity / 25% debt.
    await app.inject({
      method: "POST",
      url: `/plans/${pid}/accounts`,
      payload: {
        ...account("FIXED_TERM_DEPOSIT", 400_000),
        bucketSplitJson: JSON.stringify({ EQUITY: 0.75, DEBT: 0.25 }),
      },
    });

    const res = await app.inject({ method: "GET", url: `/plans/${pid}/portfolio-risk` });
    const body = res.json();

    expect(body.totalValue).toBe(400_000);
    const equity = body.buckets.find((b: { bucket: string }) => b.bucket === "EQUITY");
    const debt = body.buckets.find((b: { bucket: string }) => b.bucket === "DEBT");
    expect(equity.currentValue).toBeCloseTo(300_000, 6); // 0.75 * 400_000
    expect(debt.currentValue).toBeCloseTo(100_000, 6); // 0.25 * 400_000
  });

  it("404s the route for a missing plan", async () => {
    const res = await app.inject({ method: "GET", url: "/plans/ghost/portfolio-risk" });
    expect(res.statusCode).toBe(404);
  });
});
