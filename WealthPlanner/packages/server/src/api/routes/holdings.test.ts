import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { openDb, type Db } from "../../db";
import { registerApiRoutes } from "../routes";

let db: Db;
let close: () => void;
let app: FastifyInstance;
let planId: string;
let directId: string;
let pooledId: string;

beforeAll(async () => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-h-")), "h.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db);
  await app.ready();

  const created = await app.inject({
    method: "POST",
    url: "/plans",
    payload: {
      ownerName: "Aya",
      dateOfBirth: "1986-05-10",
      targetRetirementDate: "2060-01-01",
      baseCurrency: "INR",
      jurisdictionPackId: "IN-2025",
    },
  });
  planId = created.json().id;

  const direct = await app.inject({
    method: "POST",
    url: `/plans/${planId}/accounts`,
    payload: {
      label: "Stocks",
      instrumentType: "MARKET_LINKED_DIRECT",
      positionStructure: "lots",
      liquidity: "marketable",
      jurisdictionRuleRef: "MARKET_LINKED_DIRECT",
      currency: "INR",
      contributionRuleJson: "{}",
      roiRuleJson: "{}",
      currentBalance: 0,
    },
  });
  directId = direct.json().id;

  const pooled = await app.inject({
    method: "POST",
    url: `/plans/${planId}/accounts`,
    payload: {
      label: "Savings",
      instrumentType: "LIQUID_CASH",
      positionStructure: "single",
      liquidity: "liquid",
      jurisdictionRuleRef: "LIQUID_CASH",
      currency: "INR",
      contributionRuleJson: "{}",
      roiRuleJson: "{}",
      currentBalance: 120_000,
    },
  });
  pooledId = pooled.json().id;

  // Seed assumptions so emergency-fund inflation resolves.
  await app.inject({
    method: "PUT",
    url: `/plans/${planId}/assumptions`,
    payload: {
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
    },
  });
});

afterAll(async () => {
  await app.close();
  close();
});

describe("direct holdings route", () => {
  it("rejects non-direct-holding accounts", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/plans/${planId}/holdings/${pooledId}`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("buy a lot, update price, and see the account value reflect it", async () => {
    const buy = await app.inject({
      method: "POST",
      url: `/plans/${planId}/holdings/${directId}/lots`,
      payload: { ticker: "TATAMOTORS", quantity: 100, acquisitionDate: "2025-01-10", acquisitionPricePerUnit: 400 },
    });
    expect(buy.statusCode).toBe(201);
    expect(buy.json().currentValue).toBe(0); // no price yet

    const price = await app.inject({
      method: "POST",
      url: `/plans/${planId}/holdings/${directId}/prices`,
      payload: { ticker: "TATAMOTORS", asOfDate: "2026-01-10", pricePerUnit: 450 },
    });
    expect(price.statusCode).toBe(201);
    expect(price.json().currentValue).toBe(45000);

    const summary = await app.inject({
      method: "GET",
      url: `/plans/${planId}/holdings/${directId}`,
    });
    expect(summary.statusCode).toBe(200);
    const body = summary.json();
    expect(body.lots).toHaveLength(1);
    expect(body.lots[0].remainingQuantity).toBe(100);
    expect(body.currentValue).toBe(45000);
  });

  it("sells part of a lot and computes realized gain/tax", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/plans/${planId}/holdings/${directId}/sell`,
      payload: { date: "2026-06-01", quantity: 40, pricePerUnit: 450 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.currentValue).toBe(60 * 450); // 60 remaining × 450
    // Realized gain on 40 units: (450 - 400) * 40 = 2000, taxed at the pack's rate (>0).
    expect(body.totalGain).toBeCloseTo(2000, 6);
    // Held >365 days so LTCG applies, but the 2,000 gain is under the pack's
    // 125,000 annual exemption, so tax is zero (still exercised the pipeline).
    expect(body.totalTax).toBe(0);

    const summary = await app.inject({
      method: "GET",
      url: `/plans/${planId}/holdings/${directId}`,
    });
    expect(summary.json().lots[0].remainingQuantity).toBe(60);
  });

  it("records yield income", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/plans/${planId}/holdings/${directId}/yield`,
      payload: { date: "2026-07-01", amount: 1500, description: "Dividend" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().amount).toBe(1500);

    const summary = await app.inject({
      method: "GET",
      url: `/plans/${planId}/holdings/${directId}`,
    });
    expect(summary.json().yieldEntries).toHaveLength(1);
  });
});

describe("balance reconciliation route", () => {
  it("lists accounts and bulk-updates their balances", async () => {
    const list = await app.inject({
      method: "GET",
      url: `/plans/${planId}/reconciliation`,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBeGreaterThanOrEqual(2);

    const res = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/reconciliation`,
      payload: {
        periodEnd: "2026-08-31",
        rows: [
          { accountId: pooledId, actualBalance: 150_000 },
          { accountId: directId, actualBalance: 27_000 },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reconciled).toBe(2);

    const accts = await app.inject({
      method: "GET",
      url: `/plans/${planId}/accounts`,
    });
    const byId = Object.fromEntries(accts.json().map((a: { id: string }) => [a.id, a]));
    expect(byId[pooledId].currentBalance).toBe(150_000);
  });

  it("rejects an account from another plan", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/reconciliation`,
      payload: { periodEnd: "2026-08-31", rows: [{ accountId: "foreign", actualBalance: 1 }] },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("emergency fund route", () => {
  it("returns current inputs for prefilling", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/plans/${planId}/emergency-fund`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().liquidBalance).toBe(150_000); // reconciled above
    expect(res.json().inflationRate).toBe(0.075);
  });

  it("assesses the fund against a coverage target", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/plans/${planId}/emergency-fund`,
      payload: { targetCoverageMonths: 6, monthlyExpense: 50_000 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.targetAmount).toBe(300_000);
    expect(body.currentBalance).toBe(150_000);
    expect(body.onTarget).toBe(false);
  });
});
