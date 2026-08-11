import { describe, expect, it } from "vitest";
import { MonteCarloPool, resolveWorkerPath } from "./workerPool";
import { runSingleBlended } from "@wealthpath/engine";

// The server isn't built during `npm test`, so spawn the TS worker and load TS
// in the worker thread via tsx (a devDependency).
const workerPath = resolveWorkerPath();
const execArgv = ["--require", "tsx"];

const INPUT = {
  fixedIncomeSleeve: 36_096_680.077,
  marketSleeve: 412_358_392.072,
  yearlyExpenditure: 4_349_232.33,
  fixedIncomeROI: 0.07,
  inflation: 0.08,
  marketMean: 0.12,
  marketVol: 0.18,
  crashFloor: -0.6,
  trialCount: 4000,
  years: 41,
  seed: 12345,
};

describe("MonteCarloPool (docs/07 §7.4)", () => {
  it("runs a job in a worker thread and streams progress", async () => {
    const pool = new MonteCarloPool({ workerPath, execArgv, maxConcurrent: 1 });
    const progress: number[] = [];
    const handle = pool.submit("SINGLE_BLENDED", INPUT, (c) => progress.push(c));

    const result = await handle.done;
    expect(progress.length).toBeGreaterThan(1);
    expect(progress[progress.length - 1]).toBe(INPUT.trialCount);

    // Worker result must match a direct call to the same pure engine.
    const direct = runSingleBlended(INPUT);
    expect(result.median).toBeCloseTo(direct.median, 6);
    expect(result.probabilityOfSuccess).toBe(direct.probabilityOfSuccess);
  });

  it("queues jobs beyond maxConcurrent and returns both results", async () => {
    const pool = new MonteCarloPool({ workerPath, execArgv, maxConcurrent: 1 });
    const a = pool.submit("SINGLE_BLENDED", { ...INPUT, seed: 1 });
    const b = pool.submit("SINGLE_BLENDED", { ...INPUT, seed: 2 });
    const [ra, rb] = await Promise.all([a.done, b.done]);
    expect(ra.median).not.toBe(rb.median);
  });

  it("cancels a running job without hanging", async () => {
    const pool = new MonteCarloPool({ workerPath, execArgv, maxConcurrent: 1 });
    const handle = pool.submit("SINGLE_BLENDED", { ...INPUT, trialCount: 500_000 });

    await handle.cancel();
    const outcome = await handle.done.then(
      () => "resolved",
      () => "rejected",
    );
    expect(["resolved", "rejected"]).toContain(outcome);
  });
});
