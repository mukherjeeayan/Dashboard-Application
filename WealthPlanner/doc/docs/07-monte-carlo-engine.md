# 07. Monte Carlo Engine Specification

Replaces `MacroMonteCarlo.bas` (5 Subs, 2 helper functions, source §4) with
a TypeScript `worker_threads`-based engine. The VBA module's central
insight — replicate the exact formulas in memory instead of a worksheet
grid, to escape Excel's 16,384-column limit — has no direct analogue
problem in a Node process (no column limit), but the "run off the main
thread, report only summary statistics" design is still exactly right and
is kept.

## 7.1 Why worker_threads, not the main server thread

10,000 trials × up to 41 years × multiple RNG draws per year, run
synchronously, would block the Fastify event loop and freeze every other
request (including simple reads for other dashboards) for the run's
duration — worse than the workbook's own Alt+F8 experience, which at least
only blocked Excel's UI, not a shared server. `worker_threads` isolates
this exactly as the source VBA isolated its trial loop from Excel's normal
recalculation (§4.2's "disables screen updating and switches to manual
calculation... restores both in every exit path").

## 7.2 The three engines, ported 1:1

| Source Sub | WealthPath module | Replicates |
|---|---|---|
| `RunMonteCarloSimulation_Macro` | `monteCarlo/engineSingleBlended.ts` | Single blended-CAGR market return, §3.8 |
| `RunCorrelatedMonteCarlo_Macro` | `monteCarlo/engineCorrelated.ts` | Correlated Equity/Gold via Cholesky-style pair construction, §3.9 |
| `RunAccumulationMonteCarlo_Macro` | `monteCarlo/engineAccumulation.ts` | Pre-retirement MF-equivalent build-up, plus the "extra working years needed at P10" solve (§4.5) |
| `RunMacroMonteCarlo` (the combined engine) | `monteCarlo/engineMacroCombined.ts` | Full glide-path + mean-reverting inflation + tax waterfall, §3.10 |
| `RunAllLegacyMonteCarlos` | `POST /api/monte-carlo/run-all` (server-orchestrated, not a single engine module) | Convenience trigger that queues all engines in sequence |

Each module is a **pure function**: `(planSnapshot, jurisdictionPack,
trialCount, seed?) => PercentileCurve`. It is imported unmodified by both
the worker (production path) and Vitest (test path) — there is exactly one
implementation, never a "test version" and a "real version."

## 7.3 Trial loop structure (engineMacroCombined, the most complete engine)

Directly mirrors source §3.10's pseudocode:

```typescript
function runMacroCombined(
  snapshot: PlanSnapshot, pack: JurisdictionPack,
  trialCount: number, seed?: number
): PercentileCurve {
  const rng = seed !== undefined ? seededRng(seed) : defaultRng();
  const results: number[][] = []; // [trial][year] -> corpus

  for (let trial = 0; trial < trialCount; trial++) {
    let liquid = snapshot.liquidSleeveAtRetirement;
    let locked = snapshot.lockedSleeveAtRetirement;
    let inflation = pack... /* starting inflation */;
    const trialCurve: number[] = [];

    for (let year = 0; year < snapshot.horizonYears; year++) {
      inflation = drawMeanRevertingInflation(inflation, snapshot.assumptions, rng);
      const expend = year === 0
        ? snapshot.baseAnnualExpense
        : trialCurve.expensePrevYear * (1 + inflation);
      const glideWeights = glidePathWeights(year, snapshot.assumptions);
      const blendReturn = correlatedBlendedReturn(glideWeights, snapshot.assumptions, rng);

      liquid *= (1 + blendReturn);
      locked *= (1 + pack.instrumentRules.PPF_EQUIVALENT.declaredRate); // resolved via jurisdictionRuleRef, not hardcoded

      const { unmetNeed } = runWithdrawalWaterfall(expend, { liquid, locked }, pack);
      trialCurve.push(liquid + locked);
    }
    results.push(trialCurve);
  }

  return percentileCurve(results, [10, 50, 90]); // P10/P50/P90 per year, matching source's output shape
}
```

## 7.4 Progress reporting & cancellation

Unlike the VBA module (which blocks Excel's UI for the run's duration with
no progress indicator beyond a final status message in cell B7, §4.2),
WealthPath's worker posts progress messages every N trials
(`{ type: "progress", completedTrials, totalTrials }`), which the server
relays to the client via Server-Sent Events. The UI shows a determinate
progress bar and a **Cancel** button — an explicit UX improvement over the
source tool's "wait for Alt+F8 to finish or force-quit Excel" experience.

## 7.5 Output shape & storage

A completed run is stored as a `MonteCarloRun` row:

```typescript
interface MonteCarloRun {
  id: string;
  engine: "SINGLE_BLENDED" | "CORRELATED" | "ACCUMULATION" | "MACRO_COMBINED";
  planSnapshotHash: string;   // hash of the exact inputs used — cache key
  trialCount: number;
  seed: number | null;
  startedAt: string;
  completedAt: string | null;
  status: "RUNNING" | "COMPLETE" | "FAILED" | "CANCELLED";
  resultSummary: {
    probabilityOfSuccess: number;   // % trials with corpus > 0 at horizon end
    percentiles: Record<"P10" | "P50" | "P90", number[]>; // one array per year
    min: number;
    median: number;
  } | null;
  errorMessage: string | null;
}
```

This directly generalizes the source doc's worked-example output shape
(§3.8–3.10: "Probability of Success = 98.84%; 10th percentile ≈ ₹320.3
crore; Median ≈ ₹2,000.2 crore; 90th percentile ≈ ₹8,495.8 crore") without
hardcoding currency formatting into the data — display formatting
(crore/lakh grouping for India, thousands-grouping elsewhere) is a
presentation-layer concern handled by the `client`'s locale-aware number
formatter, driven by `JurisdictionPack.locale`.

## 7.6 Performance target

10,000 trials × 41 years for `engineMacroCombined` (the heaviest engine,
combining glide path + inflation + waterfall per trial-year) must complete
in **well under the source VBA module's demonstrated sub-second
performance is not required as a hard floor** — a target of **under 5
seconds on typical consumer hardware** is set instead, since Node's
`worker_threads` overhead and TypeScript's lack of VBA's tight in-process
COM-free loop make an apples-to-apples sub-second target unrealistic and
unnecessary given the UI now shows progress rather than blocking. This
target is validated in `12-testing-strategy.md` §12.5 (performance tests).

## 7.7 What is explicitly NOT ported

- The 100-column live-worksheet-grid "quick sanity check" versions of the
  Monte Carlo tabs (source §3.8's note that a 100-trial grid is "retained
  for a quick sanity check") — irrelevant once there's no worksheet
  column limit and no need for a slower fallback; the full 10,000-trial
  engine is fast enough to be the only path.
- Manual VBA import/setup steps (source §4.1) — the engine ships compiled
  as part of the npm package; there is no analogous "import this module"
  step for the end user.
