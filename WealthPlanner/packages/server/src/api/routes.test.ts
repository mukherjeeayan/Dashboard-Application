import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { openDb, type Db } from "../db";
import { registerApiRoutes } from "./routes";

let db: Db;
let close: () => void;
let app: FastifyInstance;

const VALID_PLAN = {
  ownerName: "Aya",
  dateOfBirth: "1986-05-10",
  targetRetirementDate: "2060-01-01",
  baseCurrency: "INR",
  jurisdictionPackId: "IN-2025",
};

const VALID_ACCOUNT = {
  label: "FD",
  instrumentType: "FIXED_TERM_DEPOSIT",
  positionStructure: "single",
  liquidity: "locked",
  jurisdictionRuleRef: "FIXED_TERM_DEPOSIT",
  currency: "INR",
  contributionRuleJson: "{}",
  roiRuleJson: "{}",
  currentBalance: 250_000,
};

const VALID_ASSUMPTIONS = {
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

let planId: string;

beforeAll(async () => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-api-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db);
  await app.ready();

  const res = await app.inject({ method: "POST", url: "/plans", payload: VALID_PLAN });
  planId = res.json().id;
});

afterAll(async () => {
  await app.close();
  close();
});

describe("Plans CRUD", () => {
  it("creates a plan (201) and lists it", async () => {
    const created = await app.inject({ method: "POST", url: "/plans", payload: VALID_PLAN });
    expect(created.statusCode).toBe(201);
    expect(created.json().id).toBeTruthy();
    expect(created.json().createdAt).toBeTruthy();

    const list = await app.inject({ method: "GET", url: "/plans" });
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBeGreaterThanOrEqual(2);
  });

  it("rejects invalid currency on create", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/plans",
      payload: { ...VALID_PLAN, baseCurrency: "rupee" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION");
  });

  it("gets, updates, and deletes a plan", async () => {
    const get = await app.inject({ method: "GET", url: `/plans/${planId}` });
    expect(get.statusCode).toBe(200);

    const upd = await app.inject({
      method: "PUT",
      url: `/plans/${planId}`,
      payload: { ownerName: "Renamed" },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().ownerName).toBe("Renamed");

    // Delete a throwaway plan so the shared `planId` stays valid for the
    // nested account/assumption tests that follow.
    const throwaway = await app.inject({ method: "POST", url: "/plans", payload: VALID_PLAN });
    const throwawayId = throwaway.json().id;
    const del = await app.inject({ method: "DELETE", url: `/plans/${throwawayId}` });
    expect(del.statusCode).toBe(204);

    const gone = await app.inject({ method: "GET", url: `/plans/${throwawayId}` });
    expect(gone.statusCode).toBe(404);
  });
});

describe("Accounts CRUD (nested under a plan)", () => {
  let accountId: string;

  it("creates an account for the plan (FK satisfied)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/plans/${planId}/accounts`,
      payload: VALID_ACCOUNT,
    });
    expect(res.statusCode, `body=${res.body}`).toBe(201);
    expect(res.json().planId).toBe(planId);
    accountId = res.json().id;
  });

  it("rejects an account for a missing plan (FK)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/plans/ghost/accounts",
      payload: VALID_ACCOUNT,
    });
    expect(res.statusCode, `body=${res.body}`).toBe(404);
  });

  it("lists, gets, updates and deletes the account", async () => {
    const list = await app.inject({ method: "GET", url: `/plans/${planId}/accounts` });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const get = await app.inject({ method: "GET", url: `/plans/${planId}/accounts/${accountId}` });
    expect(get.statusCode).toBe(200);

    const upd = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/accounts/${accountId}`,
      payload: { currentBalance: 300_000 },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().currentBalance).toBe(300_000);

    const del = await app.inject({ method: "DELETE", url: `/plans/${planId}/accounts/${accountId}` });
    expect(del.statusCode).toBe(204);
  });
});

describe("Assumptions (upsert under a plan)", () => {
  it("upserts assumptions and reads them back", async () => {
    const put = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/assumptions`,
      payload: { ...VALID_ASSUMPTIONS, rngSeed: 9 },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().rngSeed).toBe(9);

    const get = await app.inject({ method: "GET", url: `/plans/${planId}/assumptions` });
    expect(get.statusCode).toBe(200);
    expect(get.json().trialCount).toBe(1000);
  });

  it("overwrites on second PUT", async () => {
    await app.inject({
      method: "PUT",
      url: `/plans/${planId}/assumptions`,
      payload: { ...VALID_ASSUMPTIONS, trialCount: 5000 },
    });
    const get = await app.inject({ method: "GET", url: `/plans/${planId}/assumptions` });
    expect(get.json().trialCount).toBe(5000);
  });

  it("404s assumptions for a missing plan", async () => {
    const get = await app.inject({ method: "GET", url: "/plans/ghost/assumptions" });
    expect(get.statusCode).toBe(404);
  });
});

describe("Goals CRUD", () => {
  it("creates, lists, updates and deletes a goal", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/plans/${planId}/goals`,
      payload: {
        label: "Retire in Goa",
        costToday: 50_000_000,
        costInflationRate: 0.08,
        expectedRoi: 0.12,
        targetYear: 2045,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().currentSavingsEarmarked).toBe(0);
    const goalId = created.json().id;

    const list = await app.inject({ method: "GET", url: `/plans/${planId}/goals` });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const upd = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/goals/${goalId}`,
      payload: { currentSavingsEarmarked: 1_000_000 },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().currentSavingsEarmarked).toBe(1_000_000);

    const del = await app.inject({ method: "DELETE", url: `/plans/${planId}/goals/${goalId}` });
    expect(del.statusCode).toBe(204);
  });

  it("rejects a goal for a missing plan (FK)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/plans/ghost/goals",
      payload: { label: "x", costToday: 1, costInflationRate: 0, expectedRoi: 0 },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("Liabilities CRUD", () => {
  it("creates and reads a liability", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/plans/${planId}/liabilities`,
      payload: { label: "Home loan", principal: 5_000_000, rate: 0.085, tenureMonths: 240, startDate: "2026-01-01" },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const get = await app.inject({ method: "GET", url: `/plans/${planId}/liabilities/${id}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().principal).toBe(5_000_000);
  });
});

describe("Insurance CRUD", () => {
  it("creates and lists a policy", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/plans/${planId}/insurance`,
      payload: { type: "TERM", coverInForce: 10_000_000, annualIncome: 2_000_000, familySize: 3 },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().familySize).toBe(3);

    const list = await app.inject({ method: "GET", url: `/plans/${planId}/insurance` });
    expect(list.json()).toHaveLength(1);
  });
});

describe("Major Expenses CRUD", () => {
  it("creates, updates and deletes an expense", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/plans/${planId}/expenses`,
      payload: { year: 2030, description: "Child wedding", amountTodayValue: 20_000_000 },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    const upd = await app.inject({
      method: "PUT",
      url: `/plans/${planId}/expenses/${id}`,
      payload: { amountTodayValue: 25_000_000 },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().amountTodayValue).toBe(25_000_000);

    const del = await app.inject({ method: "DELETE", url: `/plans/${planId}/expenses/${id}` });
    expect(del.statusCode).toBe(204);
  });
});

describe("Jurisdiction Packs", () => {
  it("lists every shipped pack, including the US and UK generalization packs", async () => {
    const res = await app.inject({ method: "GET", url: "/jurisdiction-packs" });
    expect(res.statusCode).toBe(200);
    const packs = res.json();
    for (const id of ["IN-2025", "US-2025", "UK-2025"]) {
      expect(packs.some((p: { packId: string }) => p.packId === id)).toBe(true);
    }
    expect(packs[0]).toHaveProperty("displayName");
    expect(packs[0]).toHaveProperty("currency");
  });

  it("returns a single pack and 404s for unknown ids", async () => {
    const res = await app.inject({ method: "GET", url: "/jurisdiction-packs/IN-2025" });
    expect(res.statusCode).toBe(200);
    expect(res.json().currency).toBe("INR");

    const missing = await app.inject({ method: "GET", url: "/jurisdiction-packs/XX-9999" });
    expect(missing.statusCode).toBe(404);
  });
});
