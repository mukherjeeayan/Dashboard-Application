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
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-sr-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db);
  await app.ready();

  const created = await app.inject({ method: "POST", url: "/plans", payload: PLAN });
  planId = created.json().id;

  // Seed net worth: two accounts totalling 1_000_000.
  for (const bal of [600_000, 400_000]) {
    await app.inject({
      method: "POST",
      url: `/plans/${planId}/accounts`,
      payload: {
        label: "A",
        instrumentType: "MARKET_LINKED_POOLED",
        positionStructure: "single",
        liquidity: "marketable",
        jurisdictionRuleRef: "MARKET_LINKED_POOLED",
        currency: "INR",
        contributionRuleJson: "{}",
        roiRuleJson: "{}",
        currentBalance: bal,
      },
    });
  }
});

afterAll(async () => {
  await app.close();
  close();
});

describe("sequence risk route", () => {
  it("returns empty series + null result before any data", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/sequence-risk` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.startingBalance).toBe(1_000_000);
    expect(body.returns).toEqual([]);
    expect(body.result).toBeNull();
  });

  it("persists a return series and computes the forward/reversed gap", async () => {
    const returns = [
      { yearIndex: 0, annualReturn: 0.3 },
      { yearIndex: 1, annualReturn: -0.1 },
      { yearIndex: 2, annualReturn: 0.05 },
    ];

    const put = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/sequence-risk`,
      payload: { returns },
    });
    expect(put.statusCode).toBe(200);
    const body = put.json();
    expect(body.returns).toHaveLength(3);
    expect(body.result).not.toBeNull();

    // With a zero contribution, the ending corpus is the product of (1 + r) —
    // multiplication commutes, so forward and reversed agree (gap = 0).
    const product = returns.reduce((acc, r) => acc * (1 + r.annualReturn), 1_000_000);
    expect(body.result.forward).toBeCloseTo(product, 6);
    expect(body.result.reversed).toBeCloseTo(product, 6);
    expect(body.result.gap).toBeCloseTo(0, 6);
  });

  it("replaces the series on a second PUT", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/sequence-risk`,
      payload: { returns: [{ yearIndex: 0, annualReturn: 0.1 }] },
    });
    const body = put.json();
    expect(body.returns).toHaveLength(1);
    expect(body.result.forward).toBeCloseTo(1_000_000 * 1.1, 6);
  });

  it("404s GET for a missing plan", async () => {
    const res = await app.inject({ method: "GET", url: "/plans/ghost/sequence-risk" });
    expect(res.statusCode).toBe(404);
  });
});
