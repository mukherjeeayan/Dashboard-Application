import { createHash } from "node:crypto";

/**
 * Stable hash of a Monte Carlo input snapshot, used as the cache key
 * (`monteCarloRuns.planSnapshotHash`, docs/08 §3.5, docs/07 §7.5). A stable
 * stringify (sorted keys) ensures equivalent inputs hash identically regardless
 * of property insertion order.
 */
export function hashSnapshot(value: unknown): string {
  const stable = JSON.stringify(sortKeys(value));
  return createHash("sha256").update(stable).digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
