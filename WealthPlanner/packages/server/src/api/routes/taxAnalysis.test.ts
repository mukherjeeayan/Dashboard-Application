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

const PLAN = {
  ownerName: "Aya",
  dateOfBirth: "1986-05-10",
  targetRetirementDate: "2060-01-01",
  baseCurrency: "INR",
  jurisdictionPackId: "IN-2025",
};

beforeAll(async () => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-tax-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db);
  await app.ready();

  const created = await app.inject({ method: "POST", url: "/plans", payload: PLAN });
  planId = created.json().id;

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

describe("tax analysis route", () => {
  it("returns SWP and lump-sum retention ratios with a verdict", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/tax-analysis` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.planId).toBe(planId);
    expect(body.totalCorpus).toBe(3_000_000);
    expect(body.swp.gross).toBeGreaterThan(0);
    expect(typeof body.swpRetentionRatio).toBe("number");
    expect(typeof body.lumpSumRetentionRatio).toBe("number");
    expect(body.swp.tax).toBeGreaterThanOrEqual(0);
    expect(body.lumpSum.net).toBeGreaterThanOrEqual(0);
    expect(typeof body.verdict).toBe("string");
  });

  it("404s for a missing plan", async () => {
    const res = await app.inject({ method: "GET", url: "/plans/ghost/tax-analysis" });
    expect(res.statusCode).toBe(404);
  });
});
