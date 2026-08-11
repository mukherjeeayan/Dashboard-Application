// Risk tools (docs/06 §6.5, source §3.5–§3.7).

/** Sequence-of-returns risk: run the same N annual returns forward and
 *  reversed; report the ending-corpus gap (docs/06 §6.5, source §3.5). */
export function sequenceRisk(
  returns: number[],
  startingBalance: number,
  annualContribution: number,
): { forward: number; reversed: number; gap: number } {
  const apply = (series: number[]) =>
    series.reduce((bal, r) => bal * (1 + r) + annualContribution, startingBalance);
  const forward = apply(returns);
  const reversed = apply([...returns].reverse());
  return { forward, reversed, gap: forward - reversed };
}

export interface GuardrailParams {
  upperMultiple: number; // 1.2
  lowerMultiple: number; // 0.8
  cutPct: number; // 0.1
}

/**
 * Guyton–Klinger-style guardrail withdrawal (docs/06 §6.5, source §3.6):
 * withdraw a percentage of corpus each year; if the resulting withdrawal
 * (adjusted) diverges from the previous by more than the guardrail width,
 * apply a proportional cut/raise, bounded by the cut percentage.
 */
export function guardrailWithdrawal(
  corpus: number,
  withdrawalRate: number,
  priorWithdrawal: number,
  params: GuardrailParams,
): { withdrawal: number; adjusted: boolean } {
  let withdrawal = corpus * withdrawalRate;
  let adjusted = false;

  if (priorWithdrawal > 0) {
    const ratio = withdrawal / priorWithdrawal;
    if (ratio > params.upperMultiple) {
      // Too high relative to prior — cap the increase.
      withdrawal = priorWithdrawal * (1 + params.cutPct);
      adjusted = true;
    } else if (ratio < params.lowerMultiple) {
      // Too low — cut downward.
      withdrawal = priorWithdrawal * (1 - params.cutPct);
      adjusted = true;
    }
  }
  return { withdrawal, adjusted };
}

export interface BucketAllocation {
  target: Record<string, number>;
  current: Record<string, number>;
  /** Variance-covariance matrix (lower-triangle) keyed by "A_B". */
  covariances: Record<string, number>;
}

/**
 * Portfolio variance (Markowitz) and concentration (HHI) for the four risk
 * buckets, plus per-bucket rebalancing actions (docs/06 §6.5, source §3.7,
 * docs/14 C2).
 */
export function allocationRisk(input: BucketAllocation) {
  const buckets = Object.keys(input.target);
  const total = buckets.reduce((s, b) => s + (input.current[b] ?? 0), 0);
  const weights = buckets.map((b) => (total > 0 ? (input.current[b] ?? 0) / total : 0));

  // Portfolio variance = w^T Σ w, expanding the symmetric matrix.
  let variance = 0;
  for (let i = 0; i < buckets.length; i++) {
    for (let j = 0; j < buckets.length; j++) {
      const a = buckets[i];
      const b = buckets[j];
      const cov =
        i === j
          ? input.covariances[`${a}_${a}`] ?? 0
          : input.covariances[`${a}_${b}`] ?? input.covariances[`${b}_${a}`] ?? 0;
      variance += weights[i] * weights[j] * cov;
    }
  }
  const volatility = Math.sqrt(Math.max(0, variance));

  const hhi = weights.reduce((s, w) => s + w * w, 0);

  // Rebalancing: how much to buy/sell each bucket to reach target allocation.
  const rebalance = buckets.map((b) => {
    const targetValue = input.target[b] * total;
    const currentValue = input.current[b] ?? 0;
    return { bucket: b, targetValue, currentValue, amount: targetValue - currentValue };
  });

  return { variance, volatility, hhi, rebalance };
}
