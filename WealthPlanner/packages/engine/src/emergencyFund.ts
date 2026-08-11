// Emergency fund real-purchasing-power tracking (docs/06 §6.8, source §3.13).
// Target = targetCoverageMonths × monthly expense; the fund balance is tracked
// in real (today's-money) purchasing power so inflation erodes nominal value.

export interface EmergencyFundInput {
  targetCoverageMonths: number;
  monthlyExpense: number;
  liquidBalance: number;
  inflationRate: number; // per period
  years: number;
}

export interface EmergencyFundResult {
  targetAmount: number;
  currentBalance: number;
  /** Real purchasing power of the balance at horizon end. */
  realValueAtEnd: number;
  /** Deficit (positive) between target and real value at end. */
  gapAtEnd: number;
  onTarget: boolean;
}

export function assessEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const targetAmount = input.targetCoverageMonths * input.monthlyExpense;
  const realValueAtEnd = input.liquidBalance / Math.pow(1 + input.inflationRate, input.years);
  const gapAtEnd = Math.max(0, targetAmount - realValueAtEnd);
  return {
    targetAmount,
    currentBalance: input.liquidBalance,
    realValueAtEnd,
    gapAtEnd,
    onTarget: realValueAtEnd >= targetAmount,
  };
}
