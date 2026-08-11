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
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-proj-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db);
  await app.ready();

  const created = await app.inject({ method: "POST", url: "/plans", payload: PLAN });
  planId = created.json().id;

  // One locked account + one liquid account + a major expense to draw from.
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

describe("projection route", () => {
  it("returns a year-by-year two-sleeve projection", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/projection` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.planId).toBe(planId);
    expect(body.years).toBeGreaterThan(0);
    expect(body.rows.length).toBe(body.years);

    const first = body.rows[0];
    expect(first.year).toBe(1);
    // Default returns: market CAGR 12% on the 2M liquid sleeve, 7% on the 1M
    // locked sleeve; year-1 expense (500k) is drawn from the liquid sleeve.
    expect(first.liquidBalance).toBeCloseTo(2_000_000 * 1.12 - 500_000, 6);
    expect(first.lockedBalance).toBeCloseTo(1_000_000 * 1.07, 6);
    expect(first.totalCorpus).toBeCloseTo(first.liquidBalance + first.lockedBalance, 6);

    // Years are sequential.
    const years = body.rows.map((r: { year: number }) => r.year);
    expect(years).toEqual(Array.from({ length: body.years }, (_, i) => i + 1));
  });

  it("applies inflation to the annual expense", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/projection` });
    const rows = res.json().rows as Array<{ year: number; expense: number }>;
    // Default long-run inflation 7.5%: year 2 expense = 500k * 1.075.
    expect(rows[0].expense).toBeCloseTo(500_000, 6);
    expect(rows[1].expense).toBeCloseTo(500_000 * 1.075, 6);
  });

  it("404s for a missing plan", async () => {
    const res = await app.inject({ method: "GET", url: "/plans/ghost/projection" });
    expect(res.statusCode).toBe(404);
  });
});
