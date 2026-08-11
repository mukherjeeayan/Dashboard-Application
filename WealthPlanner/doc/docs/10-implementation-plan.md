# 10. Implementation Plan

Phased so that each phase produces something runnable and independently
verifiable — no "big bang" integration at the end. Detailed task-level
breakdown lives in `11-task-list.md`; this document is the phase-level
narrative and exit criteria.

## Phase 0 — Repo & tooling bootstrap

**Goal:** an empty-but-installable npm workspace that already satisfies the
literal "one npm command installs and opens something in the browser"
requirement, before any financial logic exists.

**Exit criteria:**
- `npm install && npx wealthpath` opens the browser to a static "Hello,
  WealthPath" page served by the Fastify server.
- CI runs lint + typecheck + an empty test suite on every push.
- npm workspaces (`engine`, `server`, `client`, `cli`, `jurisdictions`) are
  wired up with working cross-package TypeScript project references.

## Phase 1 — Domain model, storage, and Jurisdiction Pack framework

**Goal:** the generalization backbone exists and is testable, before any UI.

**Exit criteria:**
- Drizzle schema + migrations for every table in
  `08-data-model-and-storage.md` §8.2.
- `JurisdictionPack` Zod schema (§05) implemented; `GENERIC-TEMPLATE.json`
  and a complete `IN-2025.json` pack (transcribed from
  `Investment_Workbook.docx`) both validate successfully.
- `npm run jurisdiction:validate` CLI command works end-to-end.
- Unit tests confirm the India pack contains every statutory number found
  in the source doc (a literal checklist test — see `11-task-list.md`
  Phase 1).

## Phase 2 — Core calculation engine (deterministic paths)

**Goal:** every non-Monte-Carlo calculation family from §3.1–§3.7, §3.11–
§3.16 of the source doc, implemented as pure TS functions, golden-tested
against the source doc's own worked examples.

**Exit criteria:**
- All modules listed in `03-architecture.md` §3.3 exist except
  `monteCarlo/*`.
- Golden-value test suite (per `12-testing-strategy.md` §12.4) passes:
  every worked example explicitly stated in `Investment_Workbook.docx` §3
  is reproduced by the engine, using India Jurisdiction Pack values, to a
  documented tolerance.
- No engine module imports a concrete Jurisdiction Pack file directly (ESLint
  rule enforced, per `05-` §5.3).

## Phase 3 — Monte Carlo engine

**Goal:** all four simulation engines from §07, running in
`worker_threads`, with progress reporting.

**Exit criteria:**
- Each of the four engines reproduces the source doc's own worked-example
  statistics (§3.8–3.10, §4.3–4.5) within a documented statistical
  tolerance (exact match isn't expected/possible for a stochastic process
  with a different RNG stream, but P10/P50/P90 and probability-of-success
  should land within a tight band when run with the frozen-seed path using
  the ported Acklam algorithm — see `12-testing-strategy.md` §12.4).
- Performance target from `07-` §7.6 met on CI runners.
- Cancellation and progress-reporting work end-to-end through the API.

## Phase 4 — API layer

**Goal:** a complete Fastify REST API exposing every read/write the UI will
need, independent of any client existing yet.

**Exit criteria:**
- Full OpenAPI/JSON-schema documentation auto-generated from the shared Zod
  schemas.
- Every endpoint has request/response validation and integration tests
  (Vitest + `supertest`-equivalent for Fastify).
- API is exercised by a Postman/Bruno collection or equivalent script for
  manual smoke testing before the client exists.

## Phase 5 — Client UI

**Goal:** every screen in `09-ui-ux-spec.md` implemented, wired to the
Phase 4 API.

**Exit criteria:**
- First-run flow (§9.3) works end-to-end in a real browser.
- All 6 non-Settings nav sections and their screens are implemented and
  empty-state handled for screens with no data yet (the 7th section,
  Settings → AI Insights, is built in Phase 7 below).
- Playwright E2E suite covers: fresh install → jurisdiction selection →
  full manual data entry → every dashboard renders correctly → Monte Carlo
  run completes and displays.

## Phase 6 — Packaging, second Jurisdiction Pack, polish

**Goal:** the actual "generalize for the entire world" claim is proven, not
just architecturally possible.

**Exit criteria:**
- `13-packaging-distribution.md` fully implemented and tested on Windows,
  macOS, and Linux (via CI matrix + at least one manual pass per OS).
- A **second** Jurisdiction Pack (US, per the source doc's own suggested
  comparison table) is authored using only the `05-` process, with **zero**
  changes to `packages/engine` — this is the concrete proof-of-generalization
  gate, not optional polish.
- Accessibility pass (§9.5), performance pass, and a documentation pass
  (in-app help text reviewed for jurisdiction-neutral language).
- `README.md` and this planning package updated to reflect any deviations
  discovered during build (living documents, not frozen specs).

## Phase 7 — AI Insights (BYOK)

**Goal:** the optional, off-by-default AI Insights feature
(`16-ai-insights-byok.md`) is fully built and independently verifiable, as
its own gated phase rather than an implicit side-effect of Phase 4/5
work — this feature is part of the complete v1.0 scope, so the product is
not considered release-ready until this phase's exit criteria are met,
exactly like Phases 0–6.

**Exit criteria:**
- Provider adapters for Anthropic, OpenAI, and a custom OpenAI-compatible
  endpoint all implemented behind the single `AiProvider` interface
  (`16-` §16.2), tested against mocked HTTP fixtures only.
- `ai_settings`/`ai_insights` tables and migration implemented per
  `16-` §16.9; `ai_settings` confirmed excluded from the Export Plan flow
  (`08-` §8.5).
- API key encryption at rest (AES-256-GCM), masked display, **Test
  Connection**, and **Remove Key** all implemented and covered by
  integration tests (`16-` §16.4).
- Settings → AI Insights screen and the five "✨ Generate Insight"
  affordances (`16-` §16.5, §16.7 / `09-` §9.7) implemented and wired to a
  real (mocked-in-CI) provider call.
- The mocked-provider Playwright E2E journey from `16-` §16.10 passes.
- Confirmed via code review that `packages/engine` and
  `packages/jurisdictions` received zero changes during this phase
  (`16-` §16.3) — a diff touching either package during Phase 7 work is a
  scope violation, not a minor implementation detail.

This phase can start as soon as Phase 4 (API layer) and Phase 5 (Client
UI) exit criteria are met, and can run in parallel with Phase 6 — nothing
in Phase 6 depends on it and nothing in it depends on Phase 6 — but the
**v1.0.0 release cut in Phase 6's task list is gated on both Phase 6 and
Phase 7 being complete**, since AI Insights is in-scope for this release,
not a follow-on.

## Explicit non-goals (permanently out of scope)

This release is the complete product — there is no "post-v1" roadmap. The
items below are deliberate, permanent scope boundaries, not gaps being
deferred to a later date:

- Live market data feeds / NAV lookups (source workbook's Power Query
  feature) — all pricing is manual entry, by design (`01-` §1.5).
- Any form of spreadsheet/CSV import — manual entry only, by design
  (`01-` §1.5).
- Multi-jurisdiction-per-plan support (an expat with accounts taxed under
  two countries' rules simultaneously) — a plan is governed by exactly one
  Jurisdiction Pack.
- Sub-national (state/provincial) tax rules within a Jurisdiction Pack —
  national-level approximation only (`05-` §5.7).
- Cloud sync / multi-device / multi-user — single local user, local
  database, by design (`01-` §1.5).
- Mobile-native app — responsive desktop/laptop browser target only.
- Arbitrary-precision decimal arithmetic — native IEEE-754 doubles
  throughout (`06-` §6.7).
- Import-from-export "restore" feature (distinct from the Export Plan
  button, `08-` §8.5) — export only, no restore path.
- Background-service/tray-icon/daemonized run mode — the process runs in
  the foreground by design (`13-` §13.3/§13.6).
- Multi-jurisdiction tax treaties / foreign tax credit computation
  (`05-` §5.7).

The one feature in this product that talks to an external service at all
is AI Insights (`16-ai-insights-byok.md`), and it is opt-in, off by
default, and uses the user's own API key rather than any service
WealthPath operates.
