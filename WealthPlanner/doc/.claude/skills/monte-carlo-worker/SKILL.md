---
name: monte-carlo-worker
description: Use this skill when building or modifying any of the four Monte Carlo engines in packages/engine/monteCarlo, the RNG helpers, or the worker_threads orchestration in packages/server that runs them off the main thread.
---

# Monte Carlo Worker Development

## When to use this skill

Any work touching `packages/engine/monteCarlo/**`, the RNG helpers under
`monteCarlo/rng/**`, or the `worker_threads` pool/orchestration code in
`packages/server`.

## Procedure

1. **Read `docs/07-monte-carlo-engine.md` in full** before touching
   anything here — it specifies which VBA Sub each engine replicates, the
   expected trial-loop structure, and the progress/cancellation contract.

2. **RNG work always starts from the ported algorithm, not a redesign.**
   - The inverse-normal transform must be Peter Acklam's rational-
     polynomial approximation, ported line-for-line from the VBA source
     reproduced in full in
     `docs/15-reference-data-and-worked-examples.md` §15.1 (`NormSInv`/
     `NormSInvRnd`) — this is deliberate (see `docs/06-` §6.6): the whole
     point is bit-comparable behavior with the source model's frozen-seed
     path, and a "cleaner" reimplementation using a different
     approximation would break that.
   - The seedable PRNG (`mulberry32` or equivalent) replaces the source's
     Lehman/Park–Miller LCG functionally (same seedable-reproducibility
     property) but does not need to be bit-identical to the LCG itself —
     only the inverse-normal transform needs to match closely, since
     that's what the source doc's accuracy claim (~1e-9 relative error)
     is about.

3. **Every engine module is a pure function**: `(planSnapshot,
   jurisdictionPack, trialCount, seed?) => PercentileCurve`. It must be
   importable identically from a Vitest test and from a `worker_threads`
   worker — never write a "test-only" or "worker-only" variant.

4. **Trial loops must never call into I/O.** No database access, no
   network calls, no logging beyond periodic progress-message posting —
   the loop needs to run as fast as possible across up to 200,000 trials
   (per the trial-count clamp documented in source §4.2).

5. **Progress reporting:** post a `{ type: "progress", completedTrials,
   totalTrials }` message every N trials (choose N so messages arrive at
   most a few times per second — too frequent adds overhead, too
   infrequent makes the progress bar feel frozen). Support cancellation by
   checking an `AbortSignal`-equivalent flag at the same cadence.

6. **Error handling in the worker must mirror the source's own discipline**
   (`docs/03-` §3.6): if a trial throws, the worker reports a failed run
   status back to the server rather than crashing the whole worker pool —
   this is the direct analogue of the VBA module's `On Error GoTo
   CleanFail` handler that always restores Excel's calculation state
   (source §4.2).

7. **Test against the source doc's worked-example statistics**, using the
   statistical-tolerance approach in `docs/12-testing-strategy.md` §12.4
   — not exact-match, except along the frozen-seed path where a tighter
   comparison is meaningful.

8. **Performance-check against the target in `docs/07-` §7.6** before
   considering an engine done — 10,000 trials for the heaviest engine
   (`engineMacroCombined`) should complete in well under 5 seconds on
   typical hardware.

## Common mistakes this skill exists to prevent

- Swapping in a "simpler" inverse-normal approximation (e.g. a lower-order
  polynomial) that looks fine on inspection but subtly shifts the tail
  probabilities the source doc's Monte Carlo results depend on.
- Running trial loops on the main server thread "just to get something
  working first" and never migrating to `worker_threads` — this blocks
  every other API request for the run's duration and must never ship even
  temporarily behind a "TODO: move to worker" comment.
- Forgetting the trial-count clamp (100–200,000, per source §4.2) and
  allowing an unbounded trial count to be requested from the API.
