# CHANGELOG

All notable changes to this project are documented here per build phase.

## [Unreleased]

### Phase 6 — packaging, accessibility, performance, docs polish
- **Tabbed plan view.** The `PlanView` no longer renders every panel on one
  scrolling page: the plan screens are grouped under eight tabs (Overview,
  Projection, Accounts & Holdings, Risk Analysis, Planning, Tax & Compliance,
  Reconciliation, AI Insights) with `role="tablist"`/`role="tab"` semantics so
  keyboard and screen-reader navigation work. Panel-triggering tests (unit and
  E2E) now click the owning tab first.
- **Packaging fix (docs/13 §13.2).** The published `wealthpath` tarball could
  not resolve the unpublished `@wealthpath/*` workspace packages at runtime
  (npm does not ship a `node_modules` inside the tarball), so `npx wealthpath`
  crashed with `Cannot find module '@wealthpath/server'`. Fixed by bundling
  `packages/server` and `packages/cli` with esbuild (`scripts/bundle.js`):
  the internal `@wealthpath/*` packages are inlined while third-party deps and
  the native `better-sqlite3` addon stay external, and each bundle ships its
  own copy of `migrations/` and `packs/` next to `dist/`. Also declared the
  full runtime dependency set (fastify, better-sqlite3, drizzle-orm, env-paths,
  @fastify/*, open, get-port, zod) in the root `dependencies` so an install
  pulls everything the built output needs.
- **Packaging verified end-to-end.** `npm pack` → fresh `npm install ./tarball`
  → run the installed CLI bundle: `/health` 200, `/jurisdiction-packs` lists
  IN/UK/US, the client SPA and SPA-fallback 200, plan creation 201, and a
  Monte Carlo run completes through the bundled `worker.js` (zeros because the
  test plan has no accounts). Package is 197 kB gzipped, 363 files.
- **Accessibility (docs/09 §9.5, WCAG 2.1 AA).** Fixed three contrast
  violations: the WARN severity amber in `ActionItemsPanel` and the waterfall
  note in `WithdrawalStrategyPanel` (`#b58500`→`#8a5a00`, 5.93:1), plus the SVG
  chart series text/stroke ambers in `ProjectionPanel`, `SequenceRiskPanel`,
  and `WithdrawalStrategyPanel` (`#e8a23d`/`#c9861f`→`#9a5b00`/`#7a4400`). The
  `e2e/x-accessibility.spec.ts` axe audit now passes with zero A/AA
  violations; extended the same axe assertion to the AI Insights screen in
  `e2e/z-aiInsights.spec.ts`.
- **Performance (docs/07 §7.6, docs/12 §12.5).** Added a CI-checked
  `performance.test.ts` asserting `engineMacroCombined` at the full 10,000
  trials × 41 years completes under the 5 s target (measured ~0.36 s here).
  Added `packages/client/scripts/checkBundleSize.js`, wired into the client
  `build`, enforcing a gzip budget (measured 58.9 kB) so the lightweight
  install stays lightweight.
- **Jurisdiction-neutral copy (docs/10 Phase 6).** Replaced the
  India-specific account-label placeholder `"Label (e.g. NPS Tier 1)"` with
  `"Label (e.g. Retirement fund)"` in `App.tsx` and the E2E specs.

### Sensitivity Matrix accessibility fix (Phase 6 polish)
- `packages/client/src/SensitivityMatrixPanel.tsx`: the heatmap now uses a
  contrast-aware text colour (`textColorFor`, WCAG 1.4.3 AA) per cell instead
  of a fixed white, and the cell `background` style is produced as a valid
  `rgb(...)` string rather than a raw object. Fixes the panel's typecheck
  errors; panel test and lint remain green.

### AI Insights (BYOK) — client UI (Phase 7)
- `packages/client/src/api.ts`: typed helpers `getAiSettings`, `putAiSettings`,
  `deleteAiSettings`, `testAiConnection`, `listInsights`, and
  `generateInsight`, with matching response types (`AiSettings`, `AiInsight`,
  `InsightType`, `AiProvider`, …).
- New `AiInsightsPanel` wired into `PlanView`: bring-your-own-key connection
  form (enabled, provider, model, custom base URL, API key — shown as a
  password field, only the last four digits of the stored key are ever
  displayed), save/test/disable controls, one-click generation for all five
  insight types, and a stored-insights list that survives reload.
- New test: `AiInsightsPanel.test.tsx` (loads settings, saves settings,
  generates an insight).
- Phase 7 verification work: added integration tests for **Remove Key** (DELETE
  clears settings, GET returns null, generation 400s) and **Test Connection**
  (`/ai/test`) to `ai.test.ts` (now 6 tests); added the mocked-provider
  Playwright E2E journey `e2e/z-aiInsights.spec.ts` per `docs/16` §16.10 — a
  local HTTP test double stands in for the provider's chat-completions endpoint
  (no real network or API key), configuring a fake key and generating one
  insight of each type.
- Server-side AI (providers, prompt templates, insight service, context
  builder, AES-256-GCM key encryption, `ai_settings`/`ai_insights` tables +
  migration, and the `/ai-settings`, `/ai/test`, and `/plans/:id/insights`
  routes) was already in place; this completes the Phase 7 client layer that
  consumes it.

### Direct holdings, balance reconciliation, and emergency fund (server → client)


- **Server routes** (`packages/server/src/api/routes/`): added `holdings.ts`,
  `reconciliation.ts`, and `emergencyFund.ts`, and registered them in
  `routes/index.ts`.
  - Holdings (`/plans/:id/holdings/:accountId`): Buy (create a lot), Sell
    (record a disposal against lots in FIFO order with realized gain/tax via
    the engine), Update Price (per-ticker price entry), and Record Yield, for
    `MARKET_LINKED_DIRECT` / `DIGITAL_ASSET` accounts. The account's
    `currentBalance` is kept equal to Σ remaining quantity × latest price.
  - Reconciliation (`/plans/:id/reconciliation`): bulk period-end entry of
    actual balances; writes each back to `currentBalance` and records a row in
    `account_balance_history`.
  - Emergency fund (`/plans/:id/emergency-fund`): real-purchasing-power
    assessment of the plan's liquid cash against a user-supplied coverage
    target, prefilled from the plan's liquid balances and inflation assumption.
- **Schemas** (`api/schemas.ts`): `CreateLotSchema`, `SellRequestSchema`,
  `CreateTickerPriceSchema`, `CreateYieldIncomeSchema`, `ReconciliationSchema`,
  `EmergencyFundRequestSchema`, plus the underlying row schemas.
- **OpenAPI** (`api/openapi.ts` + new routes): added `holdings`,
  `reconciliation`, and `emergency-fund` tags and per-route `schema`
  decorations so these endpoints carry full request/response docs in
  `/documentation`.
- **Client API** (`packages/client/src/api.ts`): typed helpers
  `getHoldings/buyLot/sell/updatePrice/recordYield`,
  `getReconciliation/putReconciliation`, and
  `getEmergencyFundInputs/assessEmergencyFund`, with matching response types.
- **Client UI**: new `HoldingsPanel`, `ReconciliationPanel`, and
  `EmergencyFundPanel` wired into `PlanView` (a holdings panel per
  direct-holding account), consistent with the existing panel conventions.
- **Fixes**: `refreshBalance` now accounts for lot disposals; the sell endpoint
  uses its own request schema (no `lotId`); capital-gains rules that are the
  `"NO_RULE"` string variant are rejected cleanly.
- **Tests**: server route tests (8) for holdings/reconciliation/emergency-fund
  including the LTCG exemption path; client panel tests for
  `ReconciliationPanel`, `HoldingsPanel`, and `EmergencyFundPanel`; e2e
  Playwright spec covering the three panels end-to-end.

### Phase 0 — Repo & tooling bootstrap (complete)
- Initialized npm-workspaces monorepo: `packages/{engine, jurisdictions, server, client, cli}`.
- Root tooling: TypeScript (strict, project references), ESLint, Prettier, Vitest.
- `@wealthpath/server`: Fastify app with `GET /health` and static serving of the
  built React client (SPA fallback).
- `@wealthpath/client`: Vite + React 18 "Hello, WealthPath" page.
- `@wealthpath/cli`: `bin` entrypoint that starts the server, polls `/health`,
  and opens the default browser (`open`), with port fallback via `get-port`.
- `@wealthpath/engine` / `@wealthpath/jurisdictions`: empty TS libs with placeholder tests.
- CI workflow (GitHub Actions) on ubuntu/windows/macos: lint, typecheck, test, build.
- `CONTRIBUTING.md` documenting layout and dev commands.
- Verified: `npm install` + build + tests (3/3 passing) + live server serving
  `/health` and the client index.

### Phase 1 — Domain model, storage, Jurisdiction Pack framework (complete)
- `packages/engine/src/types.ts`: jurisdiction-agnostic domain types (9
  `InstrumentType`s, `PositionStructure`, `Liquidity`, `Account`, `Lot`,
  `ContributionRule`/`ROIRule` discriminated unions, `Plan`, `PlanAssumptions`, …)
  per `docs/04`.
- `packages/jurisdictions/src/schema.ts`: Zod `JurisdictionPack` contract with
  discriminated unions for income tax (slab vs. flat marginal) and capital
  gains (LT/ST split vs. flat-no-holding-period), plus cross-pack consistency
  checks (`assertPackConsistency`).
- Copied the shipped `IN-2025.json` into `packages/jurisdictions/packs/` and
  validated it against the schema (schema-fidelity tests). Added
  `GENERIC-TEMPLATE.json` starter.
- `packages/jurisdictions/src/loader.ts`: load-by-id, validate, cache, throw on
  invalid. `src/cli.ts`: `npm run jurisdiction:validate -- <packId>`.
- `packages/server/src/db/`: Drizzle schema + hand-written migration
  (`0000_init.sql`) for every table in `docs/08` §8.2, `env-paths`-based DB
  path resolution, and a migration runner that applies pending SQL on startup
  (auto-run on server start). Migrations copied to `dist` at build time.
- Server now opens/migrates the SQLite DB at startup.
- Tests: schema-fidelity + consistency + validation + loader (7), DB round-trip
  + migration idempotency (3), engine types (1). Full suite: 13 passing;
  build, typecheck, lint all green.

### Phase 5 — Client UI polish (locale-aware formatting, first-run welcome, empty states)
- Added `packages/client/src/format.ts`: locale-aware `formatMoney`,
  `formatMoneyCompact`, `formatPercent`, `formatSignedPercent`, `formatNumber`
  (docs/09 §9.5). All number/currency output is now driven by the selected
  plan's `JurisdictionPack.locale` + `currency` instead of a hard-coded `en-IN`.
- Threaded the active pack's `locale` through `PlanView` and every panel
  (Projection, Tax, Sensitivity Matrix, Scenario, Withdrawal, Sequence Risk,
  Planning, Portfolio Risk, FanChart), replacing each panel's local `en-IN`
  helper.
- Added a `Welcome` first-run screen shown when no plan is selected (docs/09
  §9.3 step 1–2): setup steps + list of available jurisdiction packs.
- Added empty-state messaging to the Projection, Sensitivity Matrix, Scenario
  Analysis, and Withdrawal Strategy panels pointing users to add data first
  (docs/09 §9.3 step 5).
- New tests: `format.test.ts` (locale-aware formatting) and `Welcome.test.tsx`
  (first-run screen). Full suite: 177 passing; typecheck + lint green.
- Jurisdiction-driven account entry (docs/09 §9.3 step 4): the add-account form
  now lists the active pack's named instruments (e.g. "Mutual Fund", "PPF",
  "NPS") with their `displayLabel`s instead of generic abstract instrument
  types, and posts the pack's rule ref + mapped instrument type. Added a
  `getJurisdictionPack(packId)` client helper and `JurisdictionPack` type.
  New test asserting pack-driven labels and rule refs. Full suite: 178 passing;
  typecheck + lint green.



