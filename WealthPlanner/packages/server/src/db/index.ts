import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { resolveDbPath, ensureDbDir } from "./path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Opens (creating if needed) the SQLite database and runs pending migrations.
 * Callers may pass an explicit path (used by tests with a temp file);
 * otherwise the OS app-data path is used.
 */
export function openDb(dbPath?: string): { db: Db; path: string; close: () => void } {
  const path = dbPath ?? resolveDbPath();
  if (dbPath) {
    mkdirSync(dirname(path), { recursive: true });
  } else {
    ensureDbDir();
  }

  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  migrate(sqlite);

  const db = drizzle(sqlite, { schema });
  return { db, path, close: () => sqlite.close() };
}

/** Applies pending migration files in lexical order, tracking them in _migrations. */
function migrate(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (sqlite.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );

  const fs = readdirSync;
  const candidates = [
    join(__dirname, "migrations"), // built: dist/db/migrations (copied at build time)
    join(__dirname, "../../src/db/migrations"), // dev (tsx): src/db/migrations
  ];
  const dir = candidates.find((d) => existsSync(d));
  if (!dir) {
    throw new Error("Migrations directory not found.");
  }
  const files = fs(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const insert = sqlite.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)");
  const applyAll = sqlite.transaction(() => {
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(dir, file), "utf8");
      sqlite.exec(sql);
      insert.run(file, new Date().toISOString());
    }
  });
  applyAll();
}
