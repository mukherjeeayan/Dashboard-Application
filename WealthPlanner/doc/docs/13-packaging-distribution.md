# 13. Packaging & Distribution

## 13.1 The literal requirement

> "The npm command will install all the dependencies as well as install
> the app and open up in the local default browser."

This is satisfied by publishing a single npm package, `wealthpath`, with a
`bin` entry, runnable either via:

- **`npx wealthpath`** — no install step visible to the user; npm
  transparently downloads the package (and its dependencies, per normal
  npm resolution) into a temp cache and runs it. Best for "just try it"
  use.
- **`npm install -g wealthpath`** then **`wealthpath`** — a persistent
  global install for repeat use, so the local SQLite database (§08 §8.1)
  persists across sessions without re-downloading each time.

Both paths install dependencies via npm's normal mechanism — no custom
installer, no separate download step, satisfying the requirement exactly
as stated.

## 13.2 `package.json` shape (root, published package)

```jsonc
{
  "name": "wealthpath",
  "version": "1.0.0",
  "bin": { "wealthpath": "./packages/cli/dist/index.js" },
  "files": [
    "packages/cli/dist",
    "packages/server/dist",
    "packages/engine/dist",
    "packages/jurisdictions/dist",
    "packages/jurisdictions/packs",
    "packages/client/dist"      // pre-built static assets, NOT built at install time
  ],
  "engines": { "node": ">=20" },
  "scripts": {
    "prepublishOnly": "npm run build --workspaces"
  }
}
```

**Key decision:** the client's Vite build output and every workspace's
TypeScript build output are **pre-built and committed to the published npm
tarball** (via `files` + `prepublishOnly`), not built on the end user's
machine at install/first-run time. This is deliberate:

- Building React + Vite on every user's machine on first run would be slow
  and would require dev dependencies (Vite, TypeScript, etc.) to ship as
  runtime dependencies — bloating the install and violating the spirit of
  "just install and open," which implies a fast, simple experience.
- Publishing pre-built `dist/` output means the *published* package's
  runtime dependencies are only what `server` and `cli` actually need at
  runtime (Fastify, better-sqlite3, drizzle-orm, open, ...) — a much
  smaller, faster `npm install`.

## 13.3 `cli` entrypoint behavior

```typescript
// packages/cli/src/index.ts (illustrative)
#!/usr/bin/env node
import { startServer } from "@wealthpath/server";
import open from "open";
import getPort from "get-port";

async function main() {
  const port = await getPort({ port: [4321, 4322, 4323] }); // documented default range, falls back to any free port
  const { url } = await startServer({ port });
  console.log(`WealthPath is running at ${url}`);
  console.log(`Your data is stored locally at ${resolveDbPath()}`);
  await open(url);
}

main().catch((err) => {
  console.error("WealthPath failed to start:", err);
  process.exit(1);
});
```

- **Port selection:** tries a documented default range first (predictable
  for users who bookmark it), falls back to any free port via `get-port`
  if those are taken — avoids the app simply failing to start if the
  default port is in use by something else.
- **No daemonization, permanently:** the server runs in the foreground of
  the terminal that launched it; closing the terminal / Ctrl+C stops the
  app. This matches the source workbook's own model (Excel is a foreground
  application you close when done) and is a deliberate, permanent design
  choice to avoid the added complexity of a background-service/tray-icon
  model — not a shortcut taken for v1 that a later release revisits.
- **First-run vs. repeat-run:** the SQLite file's existence at the
  resolved path (§08 §8.1) is the only signal used to decide whether to
  show the Welcome/jurisdiction-selection flow — no separate "first run"
  flag needed.

## 13.4 Cross-platform verification

CI matrix (GitHub Actions) runs the full install-and-launch E2E test
(§12.7.1) on:

- `ubuntu-latest`
- `macos-latest`
- `windows-latest`

using a headless-browser-launch-detection strategy (Playwright can attach
to and verify the launched browser context even when the app opens the
*system* default browser, by asserting the local server received a request
matching the expected first-load route within a timeout).

## 13.5 Update story

- `npx wealthpath` always resolves to the latest published version (unless
  the user pins a version, `npx wealthpath@1.2.0`) — no separate update
  mechanism needed for the `npx` path.
- `npm install -g wealthpath` users update via `npm install -g
  wealthpath@latest` or `npm update -g wealthpath` — standard npm global
  package update flow, no custom updater needed.
- **Database migrations run automatically on server start** (`drizzle-kit`
  migration runner invoked at the top of `startServer()`), so an update
  never requires a manual migration step from the user — directly avoiding
  the source workbook's own pain point of manually re-importing an updated
  VBA module (§4.1 of source doc).

## 13.6 What is explicitly NOT built

- No installer executable (`.exe`, `.dmg`, `.AppImage`) — the whole point
  of the npm-based approach is to avoid this class of packaging entirely.
- No auto-update background service.
- No background-service/tray-icon/daemonized run mode — the server always
  runs in the foreground of the launching terminal (§13.3), permanently.
- No telemetry/analytics phoning home on launch — the app is fully local
  and offline-capable after `npm install` completes (aside from the npm
  registry fetch itself, and the AI Insights feature's opt-in provider
  calls — see `16-ai-insights-byok.md`).
