// Worker-thread entry for Monte Carlo runs (docs/07 §7.2, §7.4). Receives a
// single job message, runs the requested engine (a pure function), and posts
// progress + result messages back to the parent. Exactly one implementation is
// shared between the worker (production) and the direct-call path (tests).

import { parentPort, workerData } from "node:worker_threads";
import {
  runSingleBlended,
  runCorrelated,
  runAccumulation,
  runMacroCombined,
} from "@wealthpath/engine";

type EngineFn = (input: Record<string, unknown>) => unknown;

const ENGINES: Record<string, EngineFn> = {
  SINGLE_BLENDED: runSingleBlended as unknown as EngineFn,
  CORRELATED: runCorrelated as unknown as EngineFn,
  ACCUMULATION: runAccumulation as unknown as EngineFn,
  MACRO_COMBINED: runMacroCombined as unknown as EngineFn,
};

export interface WorkerJobMessage {
  jobId: string;
  engine: string;
  input: {
    trialCount: number;
    onProgress?: never; // injected by the worker
    [key: string]: unknown;
  };
}

if (parentPort) {
  parentPort.on("message", (msg: WorkerJobMessage) => {
    const fn = ENGINES[msg.engine];
    const totalTrials = msg.input.trialCount;
    if (!fn) {
      parentPort!.postMessage({ jobId: msg.jobId, type: "error", error: `Unknown engine: ${msg.engine}` });
      return;
    }

    const input = {
      ...msg.input,
      onProgress: (completedTrials: number) => {
        parentPort!.postMessage({
          jobId: msg.jobId,
          type: "progress",
          completedTrials,
          totalTrials,
        });
      },
    };

    try {
      const result = fn(input);
      parentPort!.postMessage({ jobId: msg.jobId, type: "result", result });
    } catch (err) {
      parentPort!.postMessage({
        jobId: msg.jobId,
        type: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Surface a single initial message so the parent can attach listeners.
  if (workerData && workerData.started) {
    parentPort.postMessage({ type: "ready" });
  }
}
