import envPaths from "env-paths";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// OS-appropriate app-data location for the SQLite file (docs/08 §8.1):
//   ~/.wealthpath/wealthpath.sqlite         (macOS/Linux)
//   %APPDATA%\wealthpath\wealthpath.sqlite  (Windows)

const paths = envPaths("wealthpath", { suffix: "" });

export function resolveDbDir(): string {
  return paths.data;
}

export function ensureDbDir(): string {
  mkdirSync(paths.data, { recursive: true });
  return paths.data;
}

export function resolveDbPath(): string {
  return join(paths.data, "wealthpath.sqlite");
}
