import { defineConfig } from "@playwright/test";

/**
 * E2E configuration for the WealthPath first-run journey. The webServer target
 * builds the client, then starts the API server (which also serves the built
 * client from dist) against a fresh temp SQLite DB on a fixed test port.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  use: {
    baseURL: "http://127.0.0.1:4380",
    trace: "retain-on-failure",
  },
  webServer: {
    // Build the server (compiled dist has the MC worker.js) and the client,
    // then serve them from the compiled E2E entry on the test port.
    command:
      "npm run build -w @wealthpath/server && npm run build -w @wealthpath/client && node packages/server/dist/e2eServe.js",
    url: "http://127.0.0.1:4380/health",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
