// Worker-pool orchestration for Monte Carlo runs (docs/07 §7.2, §7.4). Jobs are
// dispatched to worker_threads so a 10k×41yr run never blocks the Fastify event
// loop. Each job streams progress messages and supports cancellation.

import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { cpus } from "node:os";

export type MonteCarloEngine = "SINGLE_BLENDED" | "CORRELATED" | "ACCUMULATION" | "MACRO_COMBINED";

export interface MonteCarloJobInput {
  trialCount: number;
  [key: string]: unknown;
}

export interface MonteCarloJobResult {
  probabilityOfSuccess: number;
  median: number;
  min: number;
  max: number;
  curves: Array<{ year: number; P10: number; P50: number; P90: number }>;
}

export type ProgressCallback = (completedTrials: number, totalTrials: number) => void;

export interface JobHandle {
  jobId: string;
  done: Promise<MonteCarloJobResult>;
  cancel: () => Promise<void>;
}

export interface PoolOptions {
  /** Absolute path to the worker entry (defaults to the built/dev worker). */
  workerPath?: string;
  /** Maximum number of workers running concurrently. */
  maxConcurrent?: number;
  /** Extra execArgv for the worker thread (e.g. a TS loader in tests). */
  execArgv?: string[];
}

/** Resolves the worker entry path for the current build mode (dist vs src). */
export function resolveWorkerPath(): string {
  const built = join(__dirname, "worker.js");
  const dev = join(__dirname, "../../src/monteCarlo/worker.ts");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve(built);
    return built;
  } catch {
    return dev;
  }
}

interface ActiveJob {
  worker: Worker;
  finished: boolean;
  reject: (e: Error) => void;
}

export class MonteCarloPool {
  private readonly workerPath: string;
  private readonly maxConcurrent: number;
  private readonly execArgv: string[];
  private running = 0;
  private readonly queue: Array<() => void> = [];
  private readonly active = new Map<string, ActiveJob>();

  constructor(options: PoolOptions = {}) {
    this.workerPath = options.workerPath ?? resolveWorkerPath();
    this.maxConcurrent = options.maxConcurrent ?? Math.max(1, cpus().length - 1);
    const execArgv = [...(options.execArgv ?? [])];
    // When running from source (vitest/dev), the worker is TypeScript and needs
    // a loader; the compiled build is plain JS and runs without one.
    if (this.workerPath.endsWith(".ts") && !execArgv.includes("--require") && !execArgv.includes("--import")) {
      execArgv.unshift("--require", "tsx");
    }
    this.execArgv = execArgv;
  }

  submit(engine: MonteCarloEngine, input: MonteCarloJobInput, onProgress?: ProgressCallback): JobHandle {
    const jobId = `${engine}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const done = new Promise<MonteCarloJobResult>((resolveDone, rejectDone) => {
      this.enqueue(() => this.start(jobId, engine, input, onProgress, resolveDone, rejectDone));
    });

    const handle: JobHandle = {
      jobId,
      done,
      cancel: async () => {
        const job = this.active.get(jobId);
        if (!job || job.finished) return;
        job.finished = true;
        await job.worker.terminate();
        job.reject(new Error("Cancelled."));
      },
    };

    return handle;
  }

  private enqueue(start: () => void): void {
    if (this.running < this.maxConcurrent) {
      this.running += 1;
      start();
    } else {
      this.queue.push(start);
    }
  }

  private start(
    jobId: string,
    engine: MonteCarloEngine,
    input: MonteCarloJobInput,
    onProgress: ProgressCallback | undefined,
    resolveDone: (r: MonteCarloJobResult) => void,
    rejectDone: (e: Error) => void,
  ): void {
    const worker = new Worker(this.workerPath, { execArgv: this.execArgv });
    const job: ActiveJob = { worker, finished: false, reject: rejectDone };
    this.active.set(jobId, job);

    const settle = (fn: () => void) => {
      if (job.finished) return;
      job.finished = true;
      this.active.delete(jobId);
      worker.terminate().then(() => this.finish());
      fn();
    };

interface PoolMessage {
  jobId: string;
  type: "progress" | "result" | "error";
  completedTrials?: number;
  totalTrials?: number;
  result?: MonteCarloJobResult;
  error?: string;
}

    worker.on("message", (msg: PoolMessage) => {
      if (msg.jobId !== jobId) return;
      if (msg.type === "progress") {
        onProgress?.(msg.completedTrials!, msg.totalTrials!);
      } else if (msg.type === "result") {
        settle(() => resolveDone(msg.result!));
      } else if (msg.type === "error") {
        settle(() => rejectDone(new Error(msg.error ?? "Unknown worker error")));
      }
    });

    worker.on("error", (err) => {
      if (!job.finished) settle(() => rejectDone(err));
    });

    worker.on("exit", (code) => {
      if (!job.finished && code !== 0) {
        job.finished = true;
        this.active.delete(jobId);
        this.finish();
        rejectDone(new Error(`Worker exited with code ${code}.`));
      }
    });

    worker.postMessage({ jobId, engine, input });
  }

  private finish(): void {
    this.running -= 1;
    const next = this.queue.shift();
    if (next) {
      this.running += 1;
      next();
    }
  }
}
