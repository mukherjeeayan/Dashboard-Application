import { loadPack, listPackIds } from "./loader";
import { assertPackConsistency } from "./schema";

/**
 * `npm run jurisdiction:validate -- <packId>`
 * Validates a pack by id against the Zod schema + cross-pack consistency checks.
 * With no id, validates every shipped pack.
 */
function main(): void {
  const [, , maybePackId] = process.argv;

  if (maybePackId === undefined) {
    const ids = listPackIds();
    if (ids.length === 0) {
      console.error("No pack files found under packs/.");
      process.exit(1);
    }
    for (const id of ids) {
      validateAndLog(id);
    }
    return;
  }

  validateAndLog(maybePackId);
}

function validateAndLog(packId: string): void {
  try {
    const pack = loadPack(packId);
    assertPackConsistency(pack);
    console.log(`OK   ${packId}: "${pack.displayName}" (currency ${pack.currency})`);
  } catch (err) {
    console.error(`FAIL ${packId}:`, err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main();
