import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type Db } from "../db";
import { plans } from "../db/schema";
import { MonteCarloService } from "./service";
import type { MonteCarloJobResult } from "./workerPool";

let db: Db;
let close: () => void;

beforeAll(() => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-mc-svc-")), "mc.sqlite"));
  db = opened.db;
  close = opened.close;
  db.insert(plans)
    .values({
      id: "plan-1",
      dateOfBirth: "1986-01-01",
      targetRetirementDate: "2046-01-01",
      baseCurrency: "INR",
      jurisdictionPackId: "IN-2025",
      createdAt: "2026-01-01T00:00:00Z",
    })
    .run();
});

afterAll(() => close());

const RESULT: MonteCarloJobResult = {
  probabilityOfSuccess: 0.99,
  median: 42,
  min: -1,
  max: 1000,
  curves: [{ year: 1, P10: 1, P50: 42, P90: 500 }],
};

// Stub pool so the service path is exercised without spawning threads.
const stubPool = {
  submit: () => ({ done: Promise.resolve(RESULT) }),
} as never;

describe("MonteCarloService (docs/07 §7.5, cache-by-input-hash)", () => {
  it("runs, persists, then serves identical inputs from cache", async () => {
    const service = new MonteCarloService(db, stubPool);
    const input = { trialCount: 1000, seed: 12345, foo: "bar" };

    const first = await service.run({ planId: "plan-1", engine: "SINGLE_BLENDED", input, seed: 12345 });
    expect(first.cached).toBe(false);
    expect(first.result).toEqual(RESULT);

    const second = await service.run({ planId: "plan-1", engine: "SINGLE_BLENDED", input, seed: 12345 });
    expect(second.cached).toBe(true);
    expect(second.result).toEqual(RESULT);
    expect(second.runId).toBe(first.runId);
  });

  it("treats different inputs as distinct (no cache collision)", async () => {
    const service = new MonteCarloService(db, stubPool);
    await service.run({ planId: "plan-1", engine: "SINGLE_BLENDED", input: { trialCount: 500 }, seed: null });
    const other = await service.run({
      planId: "plan-1",
      engine: "SINGLE_BLENDED",
      input: { trialCount: 9999 },
      seed: null,
    });
    expect(other.cached).toBe(false);
  });
});
