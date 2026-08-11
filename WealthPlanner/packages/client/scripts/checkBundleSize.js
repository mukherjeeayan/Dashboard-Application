// Client bundle size budget check (docs/12 §12.5, §12.7; docs/02). Enforces a
// gzip-size cap on the built JS so the "one npm command install" stays
// lightweight and a dependency-bloat regression is caught in CI. Run after
// `vite build` (see package.json `build`).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DIST = join(__dirname, "../dist");
const MAX_GZIP_KB = 400; // generous headroom; current build is ~60 kB

const jsFiles = readdirSync(join(DIST, "assets"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => join(DIST, "assets", f));

if (jsFiles.length === 0) {
  console.error("Bundle check: no built JS assets found under dist/assets.");
  process.exit(1);
}

let total = 0;
for (const file of jsFiles) {
  const raw = readFileSync(file);
  const gz = gzipSync(raw, { level: 9 }).length;
  total += gz;
  const kb = (gz / 1024).toFixed(1);
  console.log(`  gzip ${kb.padStart(8)} kB  ${file.replace(join(DIST, "assets") + "\\", "")}`);
}
const totalKb = total / 1024;
console.log(`Total gzipped JS: ${totalKb.toFixed(1)} kB (budget ${MAX_GZIP_KB} kB)`);

if (totalKb > MAX_GZIP_KB) {
  console.error(`Bundle check FAILED: ${totalKb.toFixed(1)} kB exceeds ${MAX_GZIP_KB} kB budget.`);
  process.exit(1);
}
console.log("Bundle check passed.");
