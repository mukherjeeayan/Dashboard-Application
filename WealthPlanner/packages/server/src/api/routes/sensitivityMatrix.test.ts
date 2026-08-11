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
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-sm-")), "mc.sqlite"));
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

describe("sensitivity matrix route", () => {
  it("returns a square ending-corpus grid", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/plans/${planId}/sensitivity-matrix`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.planId).toBe(planId);
    expect(body.x.values.length).toBeGreaterThan(0);
    expect(body.y.values.length).toBe(body.x.values.length);
    expect(body.rows.length).toBe(body.y.values.length);
    for (const row of body.rows) expect(row.length).toBe(body.x.values.length);
    expect(typeof body.base).toBe("number");
  });

  it("has a numeric anchor equal to the base cell", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/plans/${planId}/sensitivity-matrix`,
    });
    const body = res.json();
    const midX = Math.floor((body.x.values.length - 1) / 2);
    const midY = Math.floor((body.y.values.length - 1) / 2);
    expect(body.rows[midY][midX]).toBe(body.base);
  });

  it("404s for a missing plan", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/plans/ghost/sensitivity-matrix",
    });
    expect(res.statusCode).toBe(404);
  });
});
