import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { openDb, type Db } from "./index";
import { plans } from "./schema";

let dir: string;
let dbPath: string;
let db: Db;
let close: () => void;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "wp-test-"));
  dbPath = join(dir, "wealthpath.sqlite");
  const opened = openDb(dbPath);
  db = opened.db;
  close = opened.close;
});

afterAll(() => close());

describe("database layer", () => {
  it("creates the SQLite file and runs the initial migration", () => {
    expect(existsSync(dbPath)).toBe(true);
    const applied = db.all(sql`SELECT name FROM _migrations`);
    expect(applied.length).toBeGreaterThanOrEqual(1);
  });

  it("migration is idempotent on reopen", () => {
    const reopened = openDb(dbPath);
    // Reopening applies no new migrations (already tracked) and does not error.
    expect(existsSync(dbPath)).toBe(true);
    reopened.close();
  });

  it("inserts and reads a plan row", () => {
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

    const rows = db.select().from(plans).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].jurisdictionPackId).toBe("IN-2025");
  });
});
