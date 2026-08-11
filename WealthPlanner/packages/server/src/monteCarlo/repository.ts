// Persistence + cache for Monte Carlo runs (docs/07 §7.5, docs/08 §3.5). A run
// row is keyed by planSnapshotHash so identical inputs (same engine + snapshot)
// can be served from cache instead of re-running the simulation.

import { eq, and } from "drizzle-orm";
import type { Db } from "../db";
import { monteCarloRuns } from "../db/schema";
import type { MonteCarloEngine, MonteCarloJobResult } from "./workerPool";

export type RunStatus = "RUNNING" | "COMPLETE" | "FAILED" | "CANCELLED";

export interface NewRun {
  id: string;
  planId: string;
  engine: MonteCarloEngine;
  planSnapshotHash: string;
  trialCount: number;
  seed: number | null;
  startedAt: string;
}

export interface CompletedRun {
  id: string;
  planSnapshotHash: string;
  result: MonteCarloJobResult;
  completedAt: string;
}

export class MonteCarloRunRepository {
  constructor(private readonly db: Db) {}

  create(run: NewRun): void {
    this.db.insert(monteCarloRuns).values({
      id: run.id,
      planId: run.planId,
      engine: run.engine,
      planSnapshotHash: run.planSnapshotHash,
      trialCount: run.trialCount,
      seed: run.seed,
      startedAt: run.startedAt,
      completedAt: null,
      status: "RUNNING",
      resultSummaryJson: null,
      errorMessage: null,
    }).run();
  }

  markCompleted(id: string, result: MonteCarloJobResult, completedAt: string): void {
    this.db
      .update(monteCarloRuns)
      .set({
        status: "COMPLETE",
        completedAt,
        resultSummaryJson: JSON.stringify(result),
        errorMessage: null,
      })
      .where(eq(monteCarloRuns.id, id))
      .run();
  }

  markFailed(id: string, message: string): void {
    this.db
      .update(monteCarloRuns)
      .set({ status: "FAILED", errorMessage: message })
      .where(eq(monteCarloRuns.id, id))
      .run();
  }

  markCancelled(id: string): void {
    this.db
      .update(monteCarloRuns)
      .set({ status: "CANCELLED" })
      .where(eq(monteCarloRuns.id, id))
      .run();
  }

  /** Returns a previously completed run for the same engine + snapshot hash. */
  findCached(engine: MonteCarloEngine, planSnapshotHash: string): CompletedRun | null {
    const rows = this.db
      .select()
      .from(monteCarloRuns)
      .where(and(eq(monteCarloRuns.engine, engine), eq(monteCarloRuns.planSnapshotHash, planSnapshotHash)))
      .all();
    const hit = rows.find((r) => r.status === "COMPLETE" && r.resultSummaryJson);
    if (!hit) return null;
    return {
      id: hit.id,
      planSnapshotHash: hit.planSnapshotHash,
      result: JSON.parse(hit.resultSummaryJson!) as MonteCarloJobResult,
      completedAt: hit.completedAt!,
    };
  }

  /** Returns a single run (scoped to a plan) for status polling. */
  getRun(planId: string, id: string) {
    const [row] = this.db
      .select()
      .from(monteCarloRuns)
      .where(and(eq(monteCarloRuns.id, id), eq(monteCarloRuns.planId, planId)))
      .limit(1)
      .all();
    if (!row) return null;
    return {
      id: row.id,
      planId: row.planId,
      engine: row.engine,
      planSnapshotHash: row.planSnapshotHash,
      trialCount: row.trialCount,
      seed: row.seed,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      status: row.status,
      result: row.resultSummaryJson ? (JSON.parse(row.resultSummaryJson) as MonteCarloJobResult) : null,
      errorMessage: row.errorMessage,
    };
  }
}
