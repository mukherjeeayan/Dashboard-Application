// Bundles the server so the published `wealthpath` tarball does not need the
// unpublished @wealthpath/* workspace packages at runtime (docs/13 §13.2).
//
// Only the internal @wealthpath/* packages are inlined; every third-party
// dependency stays external so it resolves from the installed `node_modules`
// (where @fastify/swagger-ui and friends can still find their static assets),
// and node builtins + the native better-sqlite3 addon are always external.
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
Promise.all([
  bundle(join(src, "index.ts"), join(outdir, "index.js")),
  // Monte Carlo runs in a worker_thread; bundle it as its own entry too.
  bundle(join(src, "monteCarlo/worker.ts"), join(outdir, "worker.js")),
]).catch(() => process.exit(1));

// The server reads migration SQL from disk at startup; ship it alongside the
// bundle (docs/08 §8.2, packages/server/src/db/index.ts).
mkdirSync(join(outdir, "migrations"), { recursive: true });
cpSync(join(src, "db/migrations"), join(outdir, "migrations"), { recursive: true });

// The inlined @wealthpath/jurisdictions code resolves Jurisdiction Packs as
// `join(__dirname, "../packs")`, which from the bundled server lands in
// packages/server/packs; ship the packs there so list/load works from the tarball.
mkdirSync(join(__dirname, "../packs"), { recursive: true });
cpSync(join(__dirname, "../../jurisdictions/packs"), join(__dirname, "../packs"), {
  recursive: true,
});
