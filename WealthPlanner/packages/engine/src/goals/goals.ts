// Goals (docs/06 §6.8, source §3.11): target-date derivation from a
// beneficiary's age, the required annual investment (PMT), and the suggested
// monthly contribution split across goal-linked funding holdings.

export interface GoalFundingInput {
  costToday: number;
  costInflationRate: number;
  expectedRoi: number;
  currentSavingsEarmarked: number;
  yearsToGoal: number;
}

/**
 * Required annual investment to reach a goal's inflated cost given current
 * earmarked savings, using the standard annuity solve:
 *   required annual pmt = (inflatedCost − currentSavings*(1+r)^n) * r / ((1+r)^n − 1)
 */
export function requiredAnnualInvestment(input: GoalFundingInput): number {
  const { costToday, costInflationRate, expectedRoi, currentSavingsEarmarked, yearsToGoal } = input;
  if (yearsToGoal <= 0) {
    // Already at/over the target year: the whole inflated cost is due now.
    return Math.max(0, costToday - currentSavingsEarmarked);
  }
  const inflatedCost = costToday * Math.pow(1 + costInflationRate, yearsToGoal);
  const futureSavings = currentSavingsEarmarked * Math.pow(1 + expectedRoi, yearsToGoal);
  const r = expectedRoi;
  const n = yearsToGoal;
  const annuityFactor = Math.pow(1 + r, n);
  const needed = inflatedCost - futureSavings;
  if (needed <= 0) return 0;
  return (needed * r) / (annuityFactor - 1);
}

/**
 * Derives a goal's target year from a beneficiary's current age and target age:
 * targetYear = currentYear + (targetAge − beneficiaryCurrentAge)
 * (docs/15 §15.3.4).
 */
export function deriveTargetYear(
  currentYear: number,
  beneficiaryCurrentAge: number,
  targetAge: number,
): number {
  return currentYear + (targetAge - beneficiaryCurrentAge);
}

/**
 * Splits a required annual investment across goal-linked funding holdings by
 * earmark weight, returning a monthly contribution per holding rounded up to
 * a practical increment (default 100) with a floored minimum.
 * Mirror of the workbook's CEILING(...,100) with a floored minimum.
 */
export function monthlyContributionPerHolding(
  annualRequired: number,
  weights: number[],
  options: { roundUpTo?: number; floorMinimum?: number } = {},
): number[] {
  const roundUpTo = options.roundUpTo ?? 100;
  const floorMinimum = options.floorMinimum ?? 0;
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  return weights.map((w) => {
    const monthly = (annualRequired * (w / totalWeight)) / 12;
    const rounded = Math.ceil(monthly / roundUpTo) * roundUpTo;
    return Math.max(rounded, floorMinimum);
  });
}
