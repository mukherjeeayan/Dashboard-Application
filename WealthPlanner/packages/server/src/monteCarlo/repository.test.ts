import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type Db } from "../db";
import { plans } from "../db/schema";
import { MonteCarloRunRepository } from "./repository";

let db: Db;
let close: () => void;
let repo: MonteCarloRunRepository;

beforeAll(() => {
  const opened = openDb(join(mkdtempSync(join(tmpdir(), "wp-mc-")), "mc.sqlite"));
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
  repo = new MonteCarloRunRepository(db);
});

afterAll(() => close());

describe("MonteCarloRunRepository (docs/07 §7.5)", () => {
  it("creates a RUNNING run and completes it", () => {
    repo.create({
      id: "run-1",
      planId: "plan-1",
      engine: "SINGLE_BLENDED",
      planSnapshotHash: "abc123",
      trialCount: 1000,
      seed: 5,
      startedAt: "2026-01-01T00:00:00Z",
    });

    const result = {
      probabilityOfSuccess: 0.98,
      median: 1_000_000,
      min: -1,
      max: 1e10,
      curves: [{ year: 1, P10: 1, P50: 2, P90: 3 }],
    };
    repo.markCompleted("run-1", result, "2026-01-01T00:01:00Z");

    const cached = repo.findCached("SINGLE_BLENDED", "abc123");
    expect(cached).not.toBeNull();
    expect(cached!.result.median).toBe(1_000_000);
  });

  it("does not return a cached hit for a different hash or engine", () => {
    expect(repo.findCached("SINGLE_BLENDED", "other-hash")).toBeNull();
    expect(repo.findCached("CORRELATED", "abc123")).toBeNull();
  });

  it("marks a failed run and does not expose it as cached", () => {
    repo.create({
      id: "run-2",
      planId: "plan-1",
      engine: "MACRO_COMBINED",
      planSnapshotHash: "fail-hash",
      trialCount: 100,
      seed: null,
      startedAt: "2026-01-01T00:00:00Z",
    });
    repo.markFailed("run-2", "boom");
    expect(repo.findCached("MACRO_COMBINED", "fail-hash")).toBeNull();
  });
});
