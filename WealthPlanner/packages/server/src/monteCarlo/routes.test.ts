import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { openDb, type Db } from "../db";
import { accounts, planAssumptions, plans } from "../db/schema";
import { registerMonteCarloRoutes } from "./routes";

let db: Db;
let close: () => void;
let app: FastifyInstance;

const seedPlan = (db: Db, planId = "plan-1", trialCount = 60) => {
  db.insert(plans)
    .values({
      id: planId,
      dateOfBirth: "1986-01-01",
      targetRetirementDate: "2067-01-01",
      baseCurrency: "INR",
      jurisdictionPackId: "IN-2025",
      createdAt: "2026-01-01T00:00:00Z",
    })
    .run();
  db.insert(planAssumptions)
    .values({
      planId,
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
      rngSeed: 7,
      trialCount,
    })
    .run();
  db.insert(accounts)
    .values({
      id: "acc-fixed",
      planId,
      label: "FD",
      instrumentType: "FIXED_TERM_DEPOSIT",
      positionStructure: "single",
      liquidity: "locked",
      jurisdictionRuleRef: "FIXED_TERM_DEPOSIT",
      currency: "INR",
      contributionRuleJson: "{}",
      roiRuleJson: "{}",
      currentBalance: 100_000,
    })
    .run();
};

beforeAll(async () => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-routes-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;
  seedPlan(db);

  app = Fastify();
  registerMonteCarloRoutes(app, { db });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  close();
});

describe("Monte Carlo routes (docs/07 §7.6)", () => {
  it("returns 404 for a missing plan", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/plans/nope/monte-carlo",
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects an invalid body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/plans/plan-1/monte-carlo",
      payload: { engine: "NOT_A_THING" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("runs the engine and returns a result with a runId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/plans/plan-1/monte-carlo",
      payload: { overrides: { trialCount: 60, seed: 1 } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cached).toBe(false);
    expect(typeof body.runId).toBe("string");
    expect(typeof body.result.probabilityOfSuccess).toBe("number");
    expect(body.result.curves.length).toBeGreaterThan(0);
  });

  it("serves identical inputs from cache (same runId)", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/plans/plan-1/monte-carlo",
      payload: { overrides: { trialCount: 60, seed: 2 } },
    });
    const second = await app.inject({
      method: "POST",
      url: "/plans/plan-1/monte-carlo",
      payload: { overrides: { trialCount: 60, seed: 2 } },
    });
    const a = first.json();
    const b = second.json();
    expect(b.cached).toBe(true);
    expect(b.runId).toBe(a.runId);
  });

  it("GET returns the persisted run status and result", async () => {
    const run = await app.inject({
      method: "POST",
      url: "/plans/plan-1/monte-carlo",
      payload: { overrides: { trialCount: 60, seed: 3 } },
    });
    const { runId } = run.json();
    const res = await app.inject({ method: "GET", url: `/plans/plan-1/monte-carlo/${runId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("COMPLETE");
    expect(res.json().result).toBeTruthy();
  });

  it("streams progress via SSE then a result event", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/plans/plan-1/monte-carlo",
      headers: { accept: "text/event-stream" },
      payload: { overrides: { trialCount: 60, seed: 4 } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    const raw = res.body;
    expect(raw).toContain("event: progress");
    expect(raw).toContain("event: result");
    expect(raw).toContain('"probabilityOfSuccess"');
  });
});
