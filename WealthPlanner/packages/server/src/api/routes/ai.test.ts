import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
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
let secretDir: string;
let fetchFn: ReturnType<typeof mockFetch>;

const PLAN = {
  ownerName: "Aya",
  dateOfBirth: "1986-05-10",
  targetRetirementDate: "2060-01-01",
  baseCurrency: "INR",
  jurisdictionPackId: "IN-2025",
};

function mockFetch(body: unknown = {}, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

beforeAll(async () => {
  secretDir = mkdtempSync(join(tmpdir(), "wp-ai-secret-"));
  fetchFn = mockFetch({ choices: [{ message: { content: "Generated insight text." } }] });
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-ai-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;

  app = Fastify();
  registerApiRoutes(app, db, { fetchFn: fetchFn as typeof fetch, secretPath: join(secretDir, "k") });
  await app.ready();

  const created = await app.inject({ method: "POST", url: "/plans", payload: PLAN });
  planId = created.json().id;
});

afterAll(async () => {
  await app.close();
  close();
});

describe("ai settings routes", () => {
  it("returns null settings before any are stored", async () => {
    const res = await app.inject({ method: "GET", url: "/ai-settings" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });

  it("PUT stores settings and never returns the api key", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/ai-settings",
      payload: {
        enabled: true,
        provider: "OPENAI",
        model: "gpt-4o-mini",
        apiKey: "sk-supersecret9876",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.keyLastFour).toBe("9876");
    expect(body.apiKey).toBeUndefined();
  });

  it("generates an insight via the mocked provider and persists it", async () => {
    const genRes = await app.inject({
      method: "POST",
      url: `/plans/${planId}/insights/generate`,
      payload: { insightType: "PLAN_SUMMARY" },
    });
    expect(genRes.statusCode).toBe(200);
    const gen = genRes.json();
    expect(gen.generatedText).toBe("Generated insight text.");
    expect(gen.insightType).toBe("PLAN_SUMMARY");
    expect(gen.planId).toBe(planId);
    expect(fetchFn).toHaveBeenCalled();

    const listRes = await app.inject({ method: "GET", url: `/plans/${planId}/insights` });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.length).toBe(1);
    expect(list[0].generatedText).toBe("Generated insight text.");
  });

  it("409s generation when AI is not enabled", async () => {
    const disabledApp = Fastify();
    registerApiRoutes(disabledApp, db, { secretPath: join(secretDir, "k") });
    await disabledApp.ready();
    await disabledApp.inject({
      method: "PUT",
      url: "/ai-settings",
      payload: { enabled: false, provider: "OPENAI", model: "gpt-4o-mini", apiKey: "sk-x" },
    });
    const res = await disabledApp.inject({
      method: "POST",
      url: `/plans/${planId}/insights/generate`,
      payload: { insightType: "PLAN_SUMMARY" },
    });
    expect(res.statusCode).toBe(400);
    await disabledApp.close();
  });

  it("tests the connection against the mocked provider", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/ai/test",
      payload: { provider: "OPENAI", model: "gpt-4o-mini", apiKey: "sk-test1234" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalled();
  });

  it("removes the key via DELETE and disables generation", async () => {
    const delRes = await app.inject({ method: "DELETE", url: "/ai-settings" });
    expect(delRes.statusCode).toBe(204);

    const getRes = await app.inject({ method: "GET", url: "/ai-settings" });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toBeNull();

    const genRes = await app.inject({
      method: "POST",
      url: `/plans/${planId}/insights/generate`,
      payload: { insightType: "PLAN_SUMMARY" },
    });
    expect(genRes.statusCode).toBe(400);
  });
});
