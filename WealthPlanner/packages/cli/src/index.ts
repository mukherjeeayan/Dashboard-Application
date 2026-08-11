#!/usr/bin/env node
import { startServer } from "@wealthpath/server";
import open from "open";
import getPort from "get-port";

const DEFAULT_PORTS = [4321, 4322, 4323];

/**
 * Polls the server /health endpoint until it responds or the timeout elapses.
 */
async function waitForHealth(url: string, timeoutMs = 10_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  const port = await getPort({ port: DEFAULT_PORTS });
  const { url } = await startServer({ port });
  console.log(`WealthPath is running at ${url}`);
  await waitForHealth(url);
  await open(url);
}

main().catch((err: unknown) => {
  console.error("WealthPath failed to start:", err);
  process.exit(1);
});
