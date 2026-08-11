# 02. Technology Stack

## 2.1 Guiding constraints

1. Must install via a **single npm command** and **open the local default
   browser automatically** — no separate download, no Docker, no external
   database server.
2. Must run **entirely locally** — no required backend service, no account.
3. Must do **heavy numerical work** (10,000-trial Monte Carlo × up to 3
   engines × 41-year paths) **fast**, without freezing the UI — this is the
   direct analogue of the workbook's VBA-in-memory replacement for
   16,384-column-limited worksheet grids.
4. Must be **long-term maintainable by one developer** (mirrors the
   workbook's single-maintainer design) — favor a small number of
   well-known, boring technologies over a large polyglot stack.
5. Cross-platform: Windows, macOS, Linux (the workbook itself is Excel/VBA,
   Windows-centric in practice; the app must not inherit that limitation).

## 2.2 Chosen stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js ≥ 20 LTS** | npm's native runtime; required for the "one npm command" install/launch requirement anyway |
| Language | **TypeScript**, strict mode, end-to-end (server, engine, client) | The financial engine is the highest-risk-of-bugs part of this project (it replaces audited spreadsheet formulas); static typing plus exhaustive-union-checked jurisdiction rules materially reduces silent formula errors |
| Local server | **Fastify** | Thin, fast, minimal-ceremony HTTP layer to serve the built frontend and expose a small local JSON API for reads/writes to the local database; chosen over Express for built-in JSON schema validation (reused for jurisdiction pack + form validation) and better TS support out of the box |
| Frontend framework | **React 18 + Vite** | Vite gives fast local dev/build; React's component model matches the "31 tabs → 31ish screens/panels" structure well and has the richest charting-library ecosystem |
| Charting | **Recharts** (primary) + **D3** (only where Recharts can't express something, e.g. the 7×7 sensitivity heat-map grid or the P10/P50/P90 fan chart) | Recharts covers line/area/bar charts declaratively for most dashboards; D3 reserved for the two chart types that need custom geometry |
| State management | **Zustand** | The app's state is mostly "one local dataset, few concurrent writers" — Redux-level ceremony isn't justified; Zustand is a thin, typed store that keeps this maintainable by one person |
| Local data storage | **SQLite via `better-sqlite3`** | Synchronous, embedded, zero-config, single-file — matches the workbook's own "one file holds everything" model, trivially backup-able (copy one `.sqlite` file), no server process to manage. Chosen over a JSON-file store because the domain has genuine relational structure (accounts → instrument type → jurisdiction rules; goals → funding schedules; loans → amortization schedules) that benefits from real queries as data grows across years |
| Schema/migrations | **Drizzle ORM** + `drizzle-kit` | Type-safe schema defined in TypeScript that generates both the SQLite schema and TS types used by the engine — avoids the "schema and types drift apart" failure mode; migrations are plain, reviewable SQL |
| Financial calculation engine | **Pure TypeScript, framework-free package** (`packages/engine`) | The engine must be usable from (a) the server for on-demand computation, (b) worker threads for Monte Carlo, and (c) unit tests in isolation — a pure, side-effect-free TS package with no framework dependency is the only shape that satisfies all three |
| Heavy computation (Monte Carlo) | **Node `worker_threads`** (server-side) with a **thin RPC layer** (`comlink`-style, or hand-rolled `postMessage` protocol) | Direct analogue of the workbook's VBA-in-memory trial loop: runs off the main thread, doesn't block the HTTP server or UI, and can be interrupted / progress-reported. Rejected: doing this in a browser Web Worker instead — see §2.4 for the client/server split rationale |
| Random number generation | **Custom seedable PRNG** (mulberry32 or PCG, implemented once in the engine package) + Peter Acklam's rational approximation for the inverse-normal CDF (ported directly from `MacroMonteCarlo.bas`'s `NormSInv`) | The workbook already solved the "avoid slow COM calls to NORMINV" problem with Acklam's algorithm — port it directly instead of re-deriving; a custom seedable PRNG is required to reproduce the workbook's "Freeze Random Seed" reproducible-run feature |
| Packaging / CLI | **`bin` field in `package.json`** pointing at a small Node CLI entrypoint; **`open`** npm package to launch the default browser; distributed via `npx wealthpath` or `npm install -g wealthpath` | Satisfies "npm command installs dependencies, installs the app, and opens the local default browser" literally — see `13-packaging-distribution.md` for the full flow |
| Validation | **Zod** | Single source of truth for runtime validation of (a) manual-entry forms, (b) Jurisdiction Pack files, (c) API request/response bodies; Zod schemas double as the TS types via `z.infer`, keeping validation and typing from drifting apart — same principle as Drizzle for the DB layer |
| Testing | **Vitest** (unit + engine golden-value tests), **Playwright** (E2E, incl. "install → open browser → complete a plan" smoke test) | Vitest is fast and works natively with the Vite/TS toolchain already in use; Playwright is needed regardless for the packaging E2E test, which is unusual enough (spawns a real CLI process, checks a real browser opened) to justify a full browser-automation tool |
| Linting/formatting | **ESLint + Prettier**, `tsc --noEmit` in CI | Standard, low-maintenance choice |
| Monorepo tooling | **npm workspaces** (no Nx/Turborepo) | Three packages (`engine`, `server`, `client`) plus a thin `cli` package do not need heavyweight monorepo tooling; npm workspaces alone keeps the "one npm command" installation story simple, since Nx/Turborepo would add their own install-time complexity |

## 2.3 Package layout (npm workspaces)

```
wealthpath/
  package.json                 # workspace root; "wealthpath" published package w/ bin entry
  packages/
    engine/                    # pure TS financial + tax + Monte Carlo engine, zero UI deps
    jurisdictions/             # Jurisdiction Pack JSON/YAML files + Zod schema + loader
    server/                    # Fastify app, SQLite/Drizzle layer, worker_threads orchestration
    client/                    # React + Vite frontend
    cli/                       # bin entrypoint: starts server, opens browser
  docs/                        # this planning package
  .claude/                     # agents & skills (see below)
```

## 2.4 Client/server split rationale

Even though this is a single-user local app, a thin local HTTP server
(rather than a pure static SPA reading/writing SQLite via a browser-side
WASM DB) is chosen because:

- `better-sqlite3` is a native Node module — it cannot run inside a browser
  tab. The alternative (`sql.js`/WASM SQLite in the browser, persisted via
  the File System Access API) is more fragile across browsers and OSes and
  complicates the "just works after `npm install`" goal.
- `worker_threads` Monte Carlo runs need a long-lived Node process anyway
  (so a page refresh doesn't kill an in-flight 10,000-trial run) — a local
  server is the natural home for that, with the UI polling or
  server-sent-events for progress.
- It mirrors the workbook's own model almost exactly: **one long-lived
  process holding all the state** (Excel + its VBA project) with a **thin
  presentation layer** on top (the worksheet grid) — here, Node process +
  SQLite file, with React as the presentation layer.

## 2.5 Alternatives considered and rejected

| Alternative | Rejected because |
|---|---|
| Electron desktop app | Heavier install (~100MB+ Chromium bundle per app), doesn't match "open in the user's own default browser" requirement, larger maintenance surface for one developer |
| Next.js full-stack framework | Its server-rendering/routing model adds complexity this single-machine, single-user tool doesn't need; a plain Fastify + Vite SPA is simpler to reason about and package |
| Python/Flask + pandas backend | The user's own toolchain and the packaging requirement are npm-centric; introducing a second language runtime (Python) breaks the "one npm command installs everything" requirement |
| MongoDB / other document DB | No server process wanted; relational structure (accounts, goals, loans, jurisdiction rules) fits SQL better than documents; SQLite needs no server at all |
| GraphQL API layer | Unnecessary indirection for a single local client talking to a co-located local server; adds a dependency and a code-gen step for no real benefit at this scale |
| Redux / Redux Toolkit | More ceremony than the app's actual state complexity warrants; Zustand covers it with far less boilerplate |
