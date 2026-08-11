// Dedicated E2E server entry: starts the server on the Playwright test port
// with a fresh temp SQLite DB and serves the built client (dist). This keeps
// E2E runs isolated from any developer's real local DB.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./index";

async function main(): Promise<void> {
  const dbPath = join(mkdtempSync(join(tmpdir(), "wp-e2e-")), "e2e.sqlite");
  const { url, close } = await startServer({ port: 4380, dbPath, serveClient: true });
  console.log(`E2E server running at ${url}`);

  const shutdown = async () => {
    await close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  console.error("E2E server failed to start:", err);
  process.exit(1);
});
