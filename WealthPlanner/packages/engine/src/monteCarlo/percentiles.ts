// Percentile summary helpers for Monte Carlo engines (docs/07 §7.5).

/** Computes the percentile values for an array of samples using the
 *  nearest-rank method (matches the workbook's reported P10/P50/P90). */
export function percentiles(values: number[], pcts: number[]): number[] {
  if (values.length === 0) throw new Error("Cannot compute percentiles of an empty sample.");
  const sorted = [...values].sort((a, b) => a - b);
  return pcts.map((p) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
  });
}

/** Convenience: returns { P10, P50, P90 } from a sample. */
export function percentileSummary(values: number[]): Record<"P10" | "P50" | "P90", number> {
  const [p10, p50, p90] = percentiles(values, [10, 50, 90]);
  return { P10: p10, P50: p50, P90: p90 };
}
