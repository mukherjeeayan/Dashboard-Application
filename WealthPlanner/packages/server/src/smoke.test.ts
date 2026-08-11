// End-to-end smoke test: builds the real server against a fresh temp SQLite DB,
// creates a plan, seeds accounts + a major expense, then exercises every
// read endpoint that backs a Phase 5 client panel — verifying the whole route
// stack + storage + engine glue works together (not just in isolation).

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { openDb, type Db } from "./db";
import { registerApiRoutes } from "./api/routes";
import { registerMonteCarloRoutes } from "./monteCarlo/routes";

let db: Db;
let close: () => void;
let app: FastifyInstance;
let planId: string;

beforeAll(async () => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-smoke-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db);
  registerMonteCarloRoutes(app, { db });
  await app.ready();
  planId = (await app.inject({
    method: "POST",
    url: "/plans",
    payload: {
      ownerName: "Aya",
      dateOfBirth: "1986-05-10",
      targetRetirementDate: "2060-01-01",
      baseCurrency: "INR",
      jurisdictionPackId: "IN-2025",
    },
  })).json().id;

  // Seed two accounts (one locked, one liquid) + a retirement spend.
  await app.inject({
    method: "POST",
    url: `/plans/${planId}/accounts`,
    payload: {
      label: "PPF",
      instrumentType: "GOV_SAFE_LOCKED",
      positionStructure: "single",
      liquidity: "locked",
      jurisdictionRuleRef: "GOV_SAFE_LOCKED",
      currency: "INR",
      contributionRuleJson: "{}",
      roiRuleJson: "{}",
      currentBalance: 1_000_000,
    },
  });
  await app.inject({
    method: "POST",
    url: `/plans/${planId}/accounts`,
    payload: {
      label: "Mutual fund",
      instrumentType: "MARKET_LINKED_POOLED",
      positionStructure: "single",
      liquidity: "marketable",
      jurisdictionRuleRef: "MARKET_LINKED_POOLED",
      currency: "INR",
      contributionRuleJson: "{}",
      roiRuleJson: "{}",
      currentBalance: 2_000_000,
    },
  });
  await app.inject({
    method: "POST",
    url: `/plans/${planId}/expenses`,
    payload: { year: 2060, description: "Retirement spend", amountTodayValue: 200_000 },
  });
});

afterAll(async () => {
  await app.close();
  close();
});

describe("end-to-end smoke", () => {
  it("overview panel", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/portfolio-risk` });
    expect(res.statusCode).toBe(200);
    expect(res.json().totalValue).toBe(3_000_000);
  });

  it("projection panel", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/projection` });
    expect(res.statusCode).toBe(200);
    expect(res.json().rows.length).toBe(res.json().years);
  });

  it("sequence risk panel", async () => {
    const get = await app.inject({ method: "GET", url: `/plans/${planId}/sequence-risk` });
    expect(get.statusCode).toBe(200);
    const put = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/sequence-risk`,
      payload: { returns: [{ yearIndex: 0, annualReturn: 0.1 }, { yearIndex: 1, annualReturn: -0.05 }] },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().result).toBeDefined();
  });

  it("withdrawal strategy panel", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/withdrawal-strategies` });
    expect(res.statusCode).toBe(200);
    expect(res.json().waterfall.length).toBe(res.json().pooled.length);
  });

  it("sensitivity matrix panel", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/sensitivity-matrix` });
    expect(res.statusCode).toBe(200);
    expect(res.json().rows.length).toBe(res.json().y.values.length);
  });

  it("scenario analysis panel", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/scenario-analysis` });
    expect(res.statusCode).toBe(200);
    expect(res.json().scenarios).toHaveLength(3);
  });

  it("action items panel", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/action-items` });
    expect(res.statusCode).toBe(200);
    expect(res.json().actionItems).toBeInstanceOf(Array);
    expect(res.json().deadlines).toBeInstanceOf(Array);
  });

  it("tax panel", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/tax-analysis` });
    expect(res.statusCode).toBe(200);
    expect(res.json().totalCorpus).toBe(3_000_000);
    expect(typeof res.json().swpRetentionRatio).toBe("number");
    expect(typeof res.json().lumpSumRetentionRatio).toBe("number");
  });

  it("monte carlo panel", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/plans/${planId}/monte-carlo`,
      headers: { Accept: "text/event-stream" },
      payload: { engine: "SINGLE_BLENDED", overrides: {} },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("result");
  });

  it("planning panels", async () => {
    for (const [name, path] of [
      ["goals", `/plans/${planId}/goals`],
      ["liabilities", `/plans/${planId}/liabilities`],
      ["insurance", `/plans/${planId}/insurance`],
      ["expenses", `/plans/${planId}/expenses`],
      ["accounts", `/plans/${planId}/accounts`],
    ] as const) {
      const res = await app.inject({ method: "GET", url: path });
      expect(res.statusCode, `${name} endpoint`).toBe(200);
    }

    // Assumptions are created via PUT (upsert); GET 200 after seeding.
    const put = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/assumptions`,
      payload: {
        marketCagr: 0.12,
        marketVolatility: 0.16,
        stochasticMode: false,
        stochasticMethodology: "SINGLE_BLENDED",
        inflationLongRunMean: 0.075,
        inflationMeanReversionSpeed: 0.2,
        inflationShockVolatility: 0,
        inflationFloor: 0,
        inflationCeiling: 0.15,
        glideStartEquity: 0.7,
        glideStep: 0.02,
        glideFloor: 0.3,
        lifestyleMultiplier: 1,
        withdrawalWaterfallEnabled: true,
        freezeRandomSeed: true,
        trialCount: 500,
      },
    });
    expect(put.statusCode).toBe(200);
    const get = await app.inject({ method: "GET", url: `/plans/${planId}/assumptions` });
    expect(get.statusCode).toBe(200);
  });
});
