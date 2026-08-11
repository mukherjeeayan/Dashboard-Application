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
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-ws-")), "mc.sqlite"));
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
    payload: { year: 2060, description: "Retirement spend", amountTodayValue: 500_000 },
  });
});

afterAll(async () => {
  await app.close();
  close();
});

describe("withdrawal strategies route", () => {
  it("returns both waterfall and pooled projections with equal length", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/plans/${planId}/withdrawal-strategies`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.planId).toBe(planId);
    expect(body.years).toBeGreaterThan(0);
    expect(body.waterfall.length).toBe(body.years);
    expect(body.pooled.length).toBe(body.years);
    expect(body.waterfallEnabled).toBe(true);

    // Both strategies are full valid projections (locked + liquid balance).
    for (let i = 0; i < body.years; i++) {
      expect(body.waterfall[i].totalCorpus).toBeCloseTo(
        body.waterfall[i].liquidBalance + body.waterfall[i].lockedBalance,
        6,
      );
      expect(body.pooled[i].totalCorpus).toBeCloseTo(
        body.pooled[i].liquidBalance + body.pooled[i].lockedBalance,
        6,
      );
    }
  });

  it("exposes the ending-corpus difference between strategies", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/plans/${planId}/withdrawal-strategies`,
    });
    const body = res.json();

    const last = body.years - 1;
    expect(body.endingDifference).toBeCloseTo(
      body.waterfall[last].totalCorpus - body.pooled[last].totalCorpus,
      6,
    );
    expect(typeof body.endingDifference).toBe("number");
  });

  it("404s for a missing plan", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/plans/ghost/withdrawal-strategies",
    });
    expect(res.statusCode).toBe(404);
  });
});
