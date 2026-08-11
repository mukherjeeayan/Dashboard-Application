// Universal recursive compounding pattern (docs/06 §6.1, source §3.1):
//
//   balance(t) = (reconciled(t-1) ?? projected(t-1) + oneTimeAdjustments(t-1))
//                * (1 + roi(t)) + contribution(t)
//
// Implemented once here and specialized per InstrumentType.

export interface CompoundStepInput {
  /** User-entered reconciled balance for the prior period (may be null). */
  priorActual: number | null;
  /** Engine-projected balance for the prior period (may be null). */
  priorProjected: number | null;
  /** This period's rate of return (already resolved by the ROIRule). */
  roi: number;
  /** This period's contribution (resolved by the ContributionRule). */
  contribution: number;
  /** Signed sum of one-time adjustments dated in the prior period (default 0). */
  oneTimeAdjustments?: number;
}

/**
 * Applies one compounding step. `priorActual ?? priorProjected` implements the
 * "Actual overrides Projected" reconciliation pattern; if neither is provided
 * the step starts from 0 (a negative starting balance is not meaningful, so 0
 * is a safe floor for a brand-new account).
 */
export function compoundStep(input: CompoundStepInput): number {
  const base = (input.priorActual ?? input.priorProjected ?? 0) + (input.oneTimeAdjustments ?? 0);
  return base * (1 + input.roi) + input.contribution;
}

export interface ProjectInput {
  openingBalance: number;
  roi: number; // constant flat rate for this deterministic projection
  annualContribution: number;
  years: number;
}

/**
 * Projects a simple flat-rate account forward for `years` periods.
 * Result[i] is the balance at the end of period i (1-indexed externally).
 */
export function projectFlat(proj: ProjectInput): number[] {
  let balance = proj.openingBalance;
  const curve: number[] = [];
  for (let i = 0; i < proj.years; i++) {
    balance = balance * (1 + proj.roi) + proj.annualContribution;
    curve.push(balance);
  }
  return curve;
}
