// Bundles the CLI so the published `wealthpath` tarball does not need the
// unpublished @wealthpath/* workspace packages at runtime (docs/13 §13.2).
//
// Only the internal @wealthpath/* packages are inlined; third-party
// dependencies (open, get-port, the inlined server's @fastify/* and friends)
// stay external so they resolve from the installed `node_modules`, and the
// native better-sqlite3 addon is always external.
const { build } = require("esbuild");
const { cpSync, mkdirSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const outdir = join(__dirname, "../dist");
mkdirSync(outdir, { recursive: true });

// Externalize every installed third-party package but bundle @wealthpath/*.
const packages = readdirSync(join(__dirname, "../../../node_modules"))
  .filter((name) => !name.startsWith("."))
  .flatMap((name) =>
    name.startsWith("@")
      ? readdirSync(join(__dirname, "../../../node_modules", name)).map((s) => `${name}/${s}`)
      : [name],
  )
  .filter((name) => !name.startsWith("@wealthpath/"));

async function bundle(entry, outfile, extraExternal = []) {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile,
    external: [...packages, ...extraExternal],
    sourcemap: true,
  });
}

const src = join(__dirname, "../src");
const serverSrc = join(__dirname, "../../server/src");
Promise.all([
  bundle(join(src, "index.ts"), join(outdir, "index.js")),
  // The inlined server runs Monte Carlo in a worker_thread resolved as
  // `__dirname/worker.js`; emit a matching bundled worker alongside the CLI.
  bundle(join(serverSrc, "monteCarlo/worker.ts"), join(outdir, "worker.js")),
]).catch(() => process.exit(1));

// The inlined server reads migration SQL from disk at startup; ship a copy
// alongside the CLI bundle too.
mkdirSync(join(outdir, "migrations"), { recursive: true });
cpSync(join(serverSrc, "db/migrations"), join(outdir, "migrations"), { recursive: true });

// The inlined @wealthpath/jurisdictions code resolves Jurisdiction Packs as
// `join(__dirname, "../packs")`, which from the bundled CLI lands in
// packages/cli/packs; ship the packs there so list/load works from the tarball.
mkdirSync(join(__dirname, "../packs"), { recursive: true });
cpSync(join(__dirname, "../../jurisdictions/packs"), join(__dirname, "../packs"), {
  recursive: true,
});
