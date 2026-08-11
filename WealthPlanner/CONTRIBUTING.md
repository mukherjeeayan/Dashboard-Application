# Contributing

WealthPath is an npm-workspaces monorepo. This file documents the layout and
local development commands (per `docs/11-task-list.md` Phase 0).

## Layout

```
packages/
  engine/          # pure TS financial/tax/Monte-Carlo engine (zero UI/DB deps)
  jurisdictions/   # Jurisdiction Pack JSON files + Zod schema + loader + validate CLI
  server/          # Fastify app, SQLite/Drizzle layer, worker_threads orchestration
  client/          # React + Vite frontend
  cli/             # bin entrypoint: starts server, opens browser
```

## Commands (run from the repo root)

| Command | What it does |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run build` | Build every workspace in dependency order |
| `npm run dev` | Run the server in watch mode |
| `npm run typecheck` | `tsc -b` across the TypeScript workspaces |
| `npm run lint` | ESLint across the repo |
| `npm test` | Vitest across the repo |
| `npm run format` | Prettier across the repo |
| `npm run jurisdiction:validate -- <packId>` | Validate a Jurisdiction Pack |
| `npx wealthpath` (after `npm link`) | Start the app and open the browser |

## Conventions

- `packages/engine` must never import a concrete Jurisdiction Pack file or any
  framework/I-O; all engine functions are pure `(inputs, jurisdictionPack) => outputs`.
- Financial amounts are IEEE-754 JS `number`s, stored as whole currency units
  with up to 2 decimal places (`docs/06` §6.7).
- Every behavior change ships with tests (`docs/12-testing-strategy.md`).
