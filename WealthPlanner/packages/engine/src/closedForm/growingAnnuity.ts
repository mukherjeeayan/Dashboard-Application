// Growing-annuity closed-form shortcut (docs/06 §6.4, source §3.4).
//
//   FV(sleeve, r, n) = sleeve*(1+r)^n − splitWeight*expense*[(1+r)^n − (1+g)^n]/(r−g)
//
// with the |r−g| < 1e-7 → n*(1+r)^(n−1) limiting-form special case preserved
// exactly (avoids division by zero).

export interface GrowingAnnuityInput {
  /** Current sleeve balance. */
  sleeve: number;
  /** Annual return. */
  r: number;
  /** Number of years. */
  n: number;
  /** Annual expense (before inflation). */
  expense: number;
  /** Inflation / expense growth rate. */
  g: number;
  /** Fraction of expense drawn from this sleeve (0..1). */
  splitWeight: number;
}

export function growingAnnuity(input: GrowingAnnuityInput): number {
  const { sleeve, r, n, expense, g, splitWeight } = input;
  const denom = r - g;

  if (Math.abs(denom) < 1e-7) {
    // Limiting form: ( (1+r)^n - (1+g)^n )/(r - g) -> n*(1+r)^(n-1) as r -> g.
    return sleeve * Math.pow(1 + r, n) - splitWeight * expense * n * Math.pow(1 + r, n - 1);
  }

  const growth = Math.pow(1 + r, n) - Math.pow(1 + g, n);
  return sleeve * Math.pow(1 + r, n) - (splitWeight * expense * growth) / denom;
}
