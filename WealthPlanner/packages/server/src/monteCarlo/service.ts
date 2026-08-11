// Orchestrates a Monte Carlo run end-to-end (docs/07 §7.5): check the input-hash
// cache, create a run row, dispatch to the worker pool, persist the result, and
// return the completed outcome (or a cached hit).

import { randomUUID } from "node:crypto";
import type { Db } from "../db";
import { hashSnapshot } from "./hash";
import {
  MonteCarloPool,
  type MonteCarloEngine,
  type MonteCarloJobInput,
  type MonteCarloJobResult,
  type ProgressCallback,
} from "./workerPool";
import { MonteCarloRunRepository } from "./repository";

export interface RunRequest {
  planId: string;
  engine: MonteCarloEngine;
  input: MonteCarloJobInput;
  seed?: number | null;
}

export interface RunOutcome {
  cached: boolean;
  runId: string;
  result: MonteCarloJobResult;
}

export class MonteCarloService {
  private readonly repo: MonteCarloRunRepository;

  constructor(
    db: Db,
    private readonly pool: MonteCarloPool = new MonteCarloPool(),
  ) {
    this.repo = new MonteCarloRunRepository(db);
  }

  /** Runs the engine (or returns a cached result for identical inputs). */
  async run(request: RunRequest, onProgress?: ProgressCallback): Promise<RunOutcome> {
    const planSnapshotHash = hashSnapshot(request.input);

    // Cache hit: identical engine + snapshot hash already completed.
    const cached = this.repo.findCached(request.engine, planSnapshotHash);
    if (cached) {
      return { cached: true, runId: cached.id, result: cached.result };
    }

    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    this.repo.create({
      id: runId,
      planId: request.planId,
      engine: request.engine,
      planSnapshotHash,
      trialCount: request.input.trialCount,
      seed: request.seed ?? null,
      startedAt,
    });

    try {
      const result = await this.pool.submit(request.engine, request.input, onProgress).done;
      this.repo.markCompleted(runId, result, new Date().toISOString());
      return { cached: false, runId, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.repo.markFailed(runId, message);
      throw err;
    }
  }
}
