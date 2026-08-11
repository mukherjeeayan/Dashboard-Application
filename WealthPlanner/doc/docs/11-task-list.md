# 11. Task List

Checkable task breakdown per phase. Each task is sized to be a single
focused work session (roughly a single Claude Code / developer session).
References to source doc sections let each task be verified against the
original spec independently.

## Phase 0 — Bootstrap

- [ ] Initialize git repo, root `package.json` with npm workspaces
      (`packages/*`).
- [ ] Scaffold `packages/cli` with a `bin/wealthpath.js` entrypoint (stub:
      logs "starting..." only).
- [ ] Scaffold `packages/server` (Fastify, one `/health` route).
- [ ] Scaffold `packages/client` (Vite + React, one static page).
- [ ] Scaffold `packages/engine` and `packages/jurisdictions` as empty
      TS libraries with `tsconfig.json` project references into the root.
- [ ] Wire `cli` → spawn `server` → poll `/health` → `open()` browser to
      the client's served URL. Verify `npx wealthpath` (via `npm link`
      locally) opens a browser tab end-to-end.
- [ ] ESLint + Prettier + `tsc --noEmit` configured at the workspace root;
      CI workflow (GitHub Actions) runs all three on every push/PR.
- [ ] Vitest configured at the workspace root with a passing placeholder
      test in each package.
- [ ] `CONTRIBUTING.md` documenting the monorepo layout and local dev
      commands (`npm run dev`, `npm run build`, `npm test`).

## Phase 1 — Domain model, storage, Jurisdiction Packs

- [ ] Define `InstrumentType` union and all shared domain types in
      `packages/engine/types.ts` per `04-domain-model.md` §4.3.
- [ ] Define `JurisdictionPack` Zod schema in `packages/jurisdictions/schema.ts`
      per `05-jurisdiction-tax-framework.md` §5.3, including discriminated
      unions for `incomeTax.kind` and `taxTreatment`.
- [ ] Write `GENERIC-TEMPLATE.json` with inline comments mapping every
      field to its source-doc section reference.
- [ ] `IN-2025.json` is **already authored and shipped** as part of this
      planning package at `packages/jurisdictions/packs/IN-2025.json` —
      copy it into the actual `packages/jurisdictions/packs/` directory as
      the starting point rather than re-transcribing from source. Every
      field cites the workbook cell/section it came from
      (`15-reference-data-and-worked-examples.md` §15.2 explains the one
      simplification it carries over: a flat marginal tax rate rather than
      a full bracket table). Confirm it passes `npm run
      jurisdiction:validate` once the schema (previous task) exists —
      don't re-derive the data, just validate the shape.
- [ ] Write a Vitest "checklist test" that asserts every field present in
      the shipped `IN-2025.json` (§ above) round-trips correctly through
      the schema after loading — this is a schema-fidelity test, not a
      re-transcription check, since transcription is already done.
- [ ] Implement `packages/jurisdictions/loader.ts`: load-by-id, validate,
      cache in memory, throw a descriptive error on invalid pack (per
      `03-architecture.md` §3.6).
- [ ] Implement `npm run jurisdiction:validate -- <packId>` CLI script.
- [ ] Design and implement Drizzle schema for every table in
      `08-data-model-and-storage.md` §8.2, including `lots`,
      `cost_basis_adjustments`, `lot_disposals`, `ticker_price_entries`,
      and `yield_income_entries`; generate first migration.
- [ ] Implement `env-paths`-based DB file location resolution; verify DB
      file is created on first server start on all 3 target OSes.

## Phase 2 — Deterministic calculation engine

- [ ] `instruments/compounding.ts` — the universal recursive pattern +
      "actual overrides projected" reconciliation logic (§3.1, §6.1).
- [ ] `instruments/marketLinked.ts`, `lockedSafe.ts`, `blendedSleeve.ts`,
      `termDeposit.ts` — one module per ROI-resolution strategy (§6.1).
- [ ] `instruments/lotBased.ts` — current-value calculation for
      `DISCRETE_LOTS` accounts (§6.1); `tax/lotDisposal.ts` — per-lot
      realized-gain and tax computation with FIFO/LIFO/specific-ID
      selection (§06 §6.9). Unit tests: partial disposal spanning two
      lots, a stock split adjustment, a flat-rate-no-holding-period
      jurisdiction rule (crypto-style).
- [ ] `projection/twoSleeve.ts`, `glidePath.ts`, `inflation.ts` (§3.3.1,
      §3.3.3).
- [ ] `projection/withdrawalWaterfall.ts` — data-driven waterfall per
      `05-` §5.4; unit test with at least 2 different pack configurations
      (India order, and a synthetic "no locked sleeve" jurisdiction) to
      prove it's genuinely data-driven.
- [ ] `closedForm/growingAnnuity.ts` including the `r≈g` limiting-form
      branch (§3.4); `sensitivityMatrix.ts`; `scenarioAnalysis.ts`.
- [ ] `risk/sequenceRisk.ts`, `guardrailWithdrawal.ts`, `allocationRisk.ts`
      (portfolio variance + HHI, §3.7).
- [ ] `goals/*` (§3.11), `tax/*` thin adapter (§3.12, delegates to active
      pack), `emergencyFund.ts` (§3.13), `insurance.ts` (§3.14),
      `liabilities.ts` (§3.15).
- [ ] `automation/deadlines.ts`, `dataHealth.ts`, `actionItems.ts` (§3.16)
      — `actionItems.ts` aggregates flags from every module above; write
      an integration test combining several modules' flags into one list.
- [ ] Add and enforce the ESLint rule banning `packages/engine/**` from
      importing `packages/jurisdictions/packs/*` directly.
- [ ] Write the golden-value test suite (see `12-` §12.4) covering every
      fixture in `15-reference-data-and-worked-examples.md` §15.3 (PPF
      compounding, EPF/PF's composed-contribution-with-cap behavior, the
      goal target-date derivation, and any further fixtures added there
      over time).

## Phase 3 — Monte Carlo engine

- [ ] `monteCarlo/rng/mulberry32.ts` (seedable PRNG).
- [ ] `monteCarlo/rng/acklamInverseNormal.ts` — port line-for-line from
      `MacroMonteCarlo.bas`'s `NormSInv`/`NormSInvRnd`; unit test against
      known standard-normal quantile values.
- [ ] `monteCarlo/engineSingleBlended.ts` (§3.8, replicates
      `RunMonteCarloSimulation_Macro`).
- [ ] `monteCarlo/engineCorrelated.ts` (§3.9, Cholesky-style correlated
      pair construction, replicates `RunCorrelatedMonteCarlo_Macro`).
- [ ] `monteCarlo/engineAccumulation.ts` (§4.5, including the "extra
      working years needed at P10" log-transform solve, replicates
      `RunAccumulationMonteCarlo_Macro`).
- [ ] `monteCarlo/engineMacroCombined.ts` (§3.10, replicates
      `RunMacroMonteCarlo`, the most complete engine).
- [ ] Worker pool orchestration in `packages/server` (`worker_threads`,
      job queue, progress messages, cancellation).
- [ ] `monte_carlo_runs` table + caching-by-input-hash logic (§03 §3.5).
- [ ] Statistical cross-validation tests against the real, verified worked
      example in `15-reference-data-and-worked-examples.md` §15.3.3, with
      documented tolerance bands (see `12-` §12.4).
- [ ] Performance test: `engineMacroCombined` at 10,000 trials completes
      within the §07 §7.6 target on CI hardware.

## Phase 4 — API layer

- [ ] Fastify route modules for: plans, assumptions, accounts, balance
      reconciliation, goals, liabilities, insurance, major expenses,
      sequence-risk returns, jurisdiction packs (list/select), Monte Carlo
      runs (start/status/cancel), and all read-only computed dashboards.
- [ ] Shared Zod schemas reused for request/response validation (no schema
      duplication between client forms and API handlers).
- [ ] Auto-generated OpenAPI spec (`@fastify/swagger` or equivalent).
- [ ] Integration test suite covering every route's happy path + validation
      failure path.
- [ ] Error-handling middleware returning consistent error shapes.

## Phase 5 — Client UI

- [ ] Design system / component library basics (buttons, forms, cards,
      badges, tables) — small, hand-rolled, no heavyweight UI framework
      dependency beyond what's already chosen.
- [ ] Welcome + Jurisdiction Selection screen (§9.3 step 1–2).
- [ ] Profile & Assumptions screen (§9.3 step 3).
- [ ] Account entry screens, one flow per `InstrumentType`, with
      jurisdiction-driven labels/help text (§9.3 step 4).
- [ ] Direct Holdings flow (Buy/Sell/Update Price/Record Yield Income) for
      `MARKET_LINKED_DIRECT` and `DIGITAL_ASSET` accounts (§09 §9.1).
- [ ] Balance Reconciliation bulk-entry screen.
- [ ] Goals, Liabilities, Insurance, Major Expenses, Emergency Fund forms.
- [ ] Sequence Risk manual-entry table (replaces "paste into column B").
- [ ] Overview dashboard (Summary + Portfolio Risk panels).
- [ ] Projection screen (table + area chart).
- [ ] Sensitivity Matrix heat-map (D3).
- [ ] Scenario Analysis cards.
- [ ] Sequence Risk dual-order chart.
- [ ] Withdrawal Strategy comparison view.
- [ ] Asset Allocation Risk screen (volatility, HHI, drift/rebalance).
- [ ] Monte Carlo screen (4 tabs, fan chart, progress bar, cancel button,
      re-run action, "last run" timestamp).
- [ ] Tax screen (retention ratio, SWP vs lump-sum).
- [ ] Deadlines & Reminders, Action Items screens.
- [ ] Empty states for every screen with no data yet, linking to the
      relevant input form.
- [ ] Locale-aware number/currency formatting wired to
      `JurisdictionPack.locale` (§9.5).
- [ ] Playwright E2E: full first-run journey + at least one Monte Carlo
      run, on a real browser.

## Phase 6 — Packaging, second pack, polish

- [ ] Implement and test the full `cli` → `open()` flow per
      `13-packaging-distribution.md` on Windows, macOS, Linux.
- [ ] `npm pack` / publish dry-run verified; global install path
      (`npm install -g wealthpath`) and `npx wealthpath` both tested.
- [ ] Author `US-2025.json` Jurisdiction Pack using only the documented
      authoring process (§05 §5.6) — zero engine code changes permitted;
      any engine change needed here is itself a Phase-2/3 bug, not a
      Phase-6 task.
- [ ] Author `UK-2025.json` as a second proof point (optional if time-
      constrained, but strengthens the generalization claim).
- [ ] Accessibility audit (WCAG 2.1 AA) + fixes.
- [ ] Performance audit across all engines + UI bundle size.
- [ ] Full documentation pass: in-app help text reviewed for
      jurisdiction-neutral language; update this planning package for any
      deviations discovered during the build.
- [ ] Cut v1.0.0 release; tag; publish to npm. **Blocked on Phase 7 below
      being complete** — AI Insights is in-scope for this release
      (`16-ai-insights-byok.md`), not a post-release add-on.

## Phase 7 — AI Insights (BYOK)

Can start once Phase 4 and Phase 5 are complete; can run in parallel with
Phase 6. See `10-implementation-plan.md` Phase 7 for exit criteria.

- [ ] Implement the shared `AiProvider` interface (`generateInsight(prompt,
      context) => text`) in `packages/server/ai`.
- [ ] Implement the Anthropic, OpenAI, and custom-OpenAI-compatible-endpoint
      adapters (`16-` §16.2), each tested only against mocked HTTP
      fixtures — no real provider call anywhere in the default test suite.
- [ ] Implement `promptTemplates.ts` — one template per insight type in
      `16-` §16.5's table.
- [ ] Implement `insightService.ts`: builds the minimal disclosed payload
      per insight type (`16-` §16.6), calls the active provider, stores
      the result.
- [ ] Add `ai_settings` and `ai_insights` tables to the Drizzle schema per
      `16-` §16.9; generate and test the migration.
- [ ] Implement AES-256-GCM key encryption using a per-install secret
      (Node's built-in `crypto`); confirm the key is never written to logs,
      error reports, or the Export Plan output (`16-` §16.4).
- [ ] Implement `POST /api/ai-insights/generate` (the only route that ever
      calls a provider — never a background job or scheduled task).
- [ ] Implement Settings → AI Insights screen: provider selector, masked
      key entry, **Test Connection**, model selection, enable/disable
      toggle, **Remove Key** (`16-` §16.7).
- [ ] Implement the "✨ Generate Insight" button and confirmation
      disclosure ("what gets sent") on all five screens listed in
      `16-` §16.5 — visible-but-explained when the feature isn't
      configured, per `09-` §9.7.
- [ ] Implement the visually-distinct AI-generated insight panel component
      (background/border treatment, "✨ AI-generated" label, timestamp).
- [ ] Unit tests: payload-construction correctness per insight type, exact
      match to `16-` §16.6's stated scope.
- [ ] Integration tests: encrypt/decrypt round-trip, **Remove Key** fully
      clears stored credentials, Export Plan never includes `ai_settings`.
- [ ] Playwright E2E: mocked-provider run of configure key → generate one
      insight of each type → verify AI-generated label renders
      (`16-` §16.10).
- [ ] Code-review confirmation that this phase's work touched zero files in
      `packages/engine` or `packages/jurisdictions` (`16-` §16.3).
