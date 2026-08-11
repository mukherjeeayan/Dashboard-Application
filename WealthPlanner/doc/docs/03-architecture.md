# 03. System Architecture

## 3.1 Process model

```
 npx wealthpath
        │
        ▼
 ┌─────────────────────┐        spawns
 │  packages/cli        │ ─────────────────┐
 │  (bin entrypoint)     │                  │
 └─────────────────────┘                  ▼
        │                        ┌─────────────────────────┐
        │ waits for "ready",     │  packages/server          │
        │ then opens browser     │  (Fastify, long-lived)    │
        ▼                        │                            │
 ┌─────────────────────┐        │  ┌──────────────────────┐  │
 │  OS default browser   │◄──────┤  │ SQLite (better-sqlite3│  │
 │  http://localhost:PORT│  HTTP │  │  single file, local)  │  │
 │  packages/client       │       │  └──────────────────────┘  │
 │  (React SPA, served    │       │                            │
 │   as static build)     │       │  ┌──────────────────────┐  │
 └─────────────────────┘        │  │ worker_threads pool    │  │
                                  │  │ (Monte Carlo engines) │  │
                                  │  └──────────────────────┘  │
                                  │                            │
                                  │  packages/engine (imported,│
                                  │  not a separate process)   │
                                  │  packages/jurisdictions    │
                                  │  (loaded packs)            │
                                  └─────────────────────────┘
```

- **`cli`** is the only piece exposed via npm's `bin` mechanism. Its job is
  narrow: find a free local port, start the server, poll a `/health`
  endpoint, then call `open(url)`. See `13-packaging-distribution.md`.
- **`server`** is a single long-lived Fastify process. It owns the SQLite
  connection and orchestrates the worker pool. It never talks to the
  network beyond `localhost` in v1, with exactly one explicit, opt-in
  exception: `server/ai`, which calls an external LLM provider directly
  from the user's own machine, using the user's own API key, only when
  explicitly triggered (see `01-product-overview.md` §1.5 and
  `16-ai-insights-byok.md` §16.3) — every other route has no live data
  feeds.
- **`client`** is a static-built React SPA served by the same Fastify
  process (no separate dev server in production). All calculation happens
  server-side; the client only renders results and posts manually-entered
  data.
- **`engine`** and **`jurisdictions`** are plain TS libraries imported
  directly into `server` (and into `worker_threads` workers, which each
  import their own copy — no shared mutable state across threads, matching
  the Monte Carlo trials' independence).

## 3.2 Why calculation lives server-side, not client-side

Three reasons, all directly inherited from constraints the workbook itself
had to solve:

1. **Determinism across the whole computed dashboard.** The workbook's
   entire design is "one Assumptions tab, every other tab is a live
   formula off it" (§2.2 of the source doc). If calculation lived in the
   browser and the user had multiple tabs/windows open, that invariant
   could be violated. A single server-side "current plan" computation
   keeps one source of truth, matching the spreadsheet's own single-file
   model.
2. **Monte Carlo needs a long-lived process.** A 10,000-trial run across
   three engines must survive page navigation/refresh and report progress
   — this needs a process that outlives any one browser tab.
3. **Reuse of the exact same formula code for both instant (closed-form)
   and simulated (Monte Carlo) results**, run from the same `engine`
   package, avoiding "the JS math and the WASM math drift apart" bugs.

## 3.3 Module boundaries inside `packages/engine`

```
engine/
  instruments/         # generic instrument-type compounding logic (§3.1 of source doc, generalized)
    compounding.ts      # Balance(t) = [actual(t-1) or projected(t-1)] * (1+ROI) + contribution(t)
    marketLinked.ts      # flat vs stochastic ROI switch, freeze-seed LCG/Acklam path
    lockedSafe.ts         # PPF/EPF-equivalent flat-rate compounding
    blendedSleeve.ts       # NPS-equivalent multi-sleeve weighted-return compounding
    termDeposit.ts          # FD-equivalent per-instrument ledger compounding
  projection/            # Future Projection v2 equivalent (§3.3 of source doc)
    twoSleeve.ts
    withdrawalWaterfall.ts   # jurisdiction-driven draw order + tax treatment (data-driven, not hardcoded steps)
    glidePath.ts
    inflation.ts             # mean-reverting bounded stochastic process
  closedForm/             # §3.4 growing-annuity shortcut
    growingAnnuity.ts
    sensitivityMatrix.ts
    scenarioAnalysis.ts
  risk/
    sequenceRisk.ts        # §3.5
    guardrailWithdrawal.ts  # §3.6
    allocationRisk.ts       # §3.7 portfolio variance/HHI
  monteCarlo/              # §3.8-3.10, see 07-monte-carlo-engine.md
    engineSingleBlended.ts
    engineCorrelated.ts
    engineMacroCombined.ts
    rng/
      mulberry32.ts
      acklamInverseNormal.ts
  goals/                   # §3.11
  tax/                      # §3.12 — thin adapter that calls into the active Jurisdiction Pack
  emergencyFund.ts           # §3.13
  insurance.ts                # §3.14
  liabilities.ts               # §3.15 loan amortization
  automation/
    deadlines.ts
    dataHealth.ts
    actionItems.ts             # aggregates flags from every module above
  types.ts                      # shared domain types (Instrument, Account, Plan, ...)
```

Every file above is **pure functions of (inputs, jurisdiction pack) →
outputs** — no I/O, no database access, no framework imports. This is what
makes the engine unit-testable against the workbook's own worked examples
(see `12-testing-strategy.md`) and reusable unmodified inside
`worker_threads`.

## 3.4 Data flow for a single "recompute the plan" action

1. User edits a value in a manual-entry form (client) → `PATCH
   /api/accounts/:id` (server).
2. Server validates against the Zod schema, writes to SQLite via Drizzle.
3. Server invalidates the cached "computed plan" for this user (there is
   only one local user, but the cache is still explicit — see §3.5).
4. Client requests `GET /api/plan/summary` (and whichever dashboard-specific
   endpoints the currently-open screen needs).
5. Server loads all accounts/goals/liabilities/assumptions + the active
   Jurisdiction Pack from SQLite, calls the relevant pure `engine`
   functions synchronously (closed-form calculations are fast — no worker
   needed), and returns computed results as JSON.
6. For Monte Carlo specifically: client calls `POST
   /api/monte-carlo/:engine/run`, server dispatches to the worker pool,
   returns a `runId` immediately, client polls `GET
   /api/monte-carlo/runs/:runId` (status + progress %) until `complete`,
   matching the workbook's own "manual trigger, wait, see result" UX
   (Alt+F8 → Run) rather than continuous background recomputation.

## 3.5 Caching / recompute strategy

- Closed-form calculations (Projection, Sensitivity Matrix, Scenario
  Analysis, Sequence Risk, Guardrail, Goals, Tax, Emergency Fund,
  Insurance, Liabilities) are cheap enough (milliseconds) to **recompute on
  every read**, exactly mirroring the workbook's own always-live formulas.
  No caching needed or wanted here — staleness bugs are worse than the
  negligible recompute cost.
- Monte Carlo results **are** cached (as a completed "run" record in
  SQLite, keyed by a hash of its inputs) because they are expensive and,
  like the workbook's own macros, are explicitly user-triggered rather than
  continuously live. The UI clearly labels a Monte Carlo panel as showing
  "last run: <timestamp>" with a **Re-run** button, directly mirroring the
  workbook's "shows only last saved results until Alt+F8" behavior
  documented in the source doc's §2.1.

## 3.6 Error handling / resilience

- If the active Jurisdiction Pack fails Zod validation at load time, the
  server refuses to start and prints the specific validation error — a
  broken pack must never silently fall back to wrong tax numbers.
- If a worker thread throws mid-trial-loop, the pool reports a failed run
  status rather than crashing the server process (direct analogue of the
  workbook's own VBA `On Error GoTo CleanFail` handler that restores Excel's
  calculation state on any error — see source doc §4.2).
- All financial calculations use a fixed-point-safe number strategy (see
  `06-financial-calculation-engine.md` §6.7) to avoid floating-point drift
  compounding over a 41-year projection.

## 3.7 AI Insights extension (optional, off by default)

`packages/server/ai` (provider adapters, prompt templates, insight
orchestration) and one new client screen (Settings → AI Insights) are the
only additions this feature makes to the architecture above — see
`16-ai-insights-byok.md` §16.3 for the module layout. `packages/engine`
and `packages/jurisdictions` are never imported by, and never import
from, `packages/server/ai`; this keeps the "pure functions of (inputs,
jurisdiction pack) → outputs" property in §3.3 completely unaffected by
whether AI Insights is enabled. The server only calls out to a provider
from an explicit `POST /api/ai-insights/generate` request — never from a
background job, a scheduled task, or a side effect of any other route.
