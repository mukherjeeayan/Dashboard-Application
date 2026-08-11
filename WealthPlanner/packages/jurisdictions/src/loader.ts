import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { JurisdictionPackSchema, assertPackConsistency, type JurisdictionPack } from "./schema";

export const PACKS_DIR = join(__dirname, "../packs");

const cache = new Map<string, JurisdictionPack>();

/**
 * The GENERIC-TEMPLATE.json file ships as an authoring starter (docs/05 §5.6)
 * but is not a real, user-selectable jurisdiction — it must never surface in
 * the list of available packs. Exclude it here so `loadPack`/the API still
 * work for it on demand, but plan creation never offers it.
 */
export const GENERIC_TEMPLATE_ID = "GENERIC-TEMPLATE";

/** Lists the ids of every usable pack file shipped in packs/. */
export function listPackIds(): string[] {
  return readdirSync(PACKS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .filter((id) => id !== GENERIC_TEMPLATE_ID);
}

/**
 * Loads and validates a Jurisdiction Pack by id. Results are cached in memory.
 * A pack that fails Zod validation or the cross-pack consistency checks throws
 * a descriptive error — a broken pack must never silently fall back to wrong
 * tax numbers (docs/03 §3.6).
 */
export function loadPack(packId: string): JurisdictionPack {
  const cached = cache.get(packId);
  if (cached) return cached;

  const path = join(PACKS_DIR, `${packId}.json`);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Jurisdiction Pack "${packId}" not found at ${path}.`);
  }

  const parsed = JurisdictionPackSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `Jurisdiction Pack "${packId}" failed validation: ${parsed.error.message}`,
    );
  }

  const pack = parsed.data;
  // Cross-pack consistency must also hold (waterfall order resolves, etc.)
  assertPackConsistency(pack);

  cache.set(packId, pack);
  return pack;
}

export function clearPackCache(): void {
  cache.clear();
}
