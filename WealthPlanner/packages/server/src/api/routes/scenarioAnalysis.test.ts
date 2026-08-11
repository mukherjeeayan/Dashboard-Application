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
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-sa-")), "mc.sqlite"));
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

describe("scenario analysis route", () => {
  it("returns best, base, and worst scenarios", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/plans/${planId}/scenario-analysis`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.planId).toBe(planId);
    expect(body.scenarios.map((s: { label: string }) => s.label).sort()).toEqual([
      "base",
      "best",
      "worst",
    ]);
    expect(typeof body.spread).toBe("number");
    for (const s of body.scenarios) expect(typeof s.endingCorpus).toBe("number");
  });

  it("404s for a missing plan", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/plans/ghost/scenario-analysis",
    });
    expect(res.statusCode).toBe(404);
  });
});
