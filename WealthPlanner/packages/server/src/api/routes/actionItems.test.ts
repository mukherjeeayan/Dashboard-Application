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
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-ai-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db);
  await app.ready();

  const created = await app.inject({ method: "POST", url: "/plans", payload: PLAN });
  planId = created.json().id;

  // A locked account (deadline + possibly stale health) and a liquid one.
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
  // A liability yields a loan-payoff deadline.
  await app.inject({
    method: "POST",
    url: `/plans/${planId}/liabilities`,
    payload: {
      label: "Home loan",
      principal: 5_000_000,
      rate: 0.085,
      tenureMonths: 240,
      startDate: "2020-01-15",
    },
  });
});

afterAll(async () => {
  await app.close();
  close();
});

describe("action items route", () => {
  it("returns deadlines, health, and aggregated action items", async () => {
    const res = await app.inject({ method: "GET", url: `/plans/${planId}/action-items` });
    console.log('RESP', JSON.stringify(res.json()));
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.planId).toBe(planId);
    expect(Array.isArray(body.deadlines)).toBe(true);
    expect(Array.isArray(body.health)).toBe(true);
    expect(Array.isArray(body.actionItems)).toBe(true);

    // Locked account + home loan produce deadlines.
    expect(body.deadlines.some((d: { kind: string }) => d.kind === "LOCKED_EXTENSION")).toBe(true);
    expect(body.deadlines.some((d: { kind: string }) => d.kind === "LOAN_PAYOFF")).toBe(true);

    // Missing expense raises a warning action item.
    expect(body.actionItems.some((a: { message: string }) => /major expense/.test(a.message))).toBe(true);
  });

  it("404s for a missing plan", async () => {
    const res = await app.inject({ method: "GET", url: "/plans/ghost/action-items" });
    expect(res.statusCode).toBe(404);
  });
});



