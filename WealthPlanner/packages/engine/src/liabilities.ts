// Loan amortization (docs/06 §6.8, source §3.15): standard reducing-balance
// formula, fully currency/jurisdiction agnostic.

export interface LoanAmortizationInput {
  principal: number;
  annualRate: number; // e.g. 0.09
  tenureMonths: number;
}

export interface AmortizationRow {
  month: number;
  interest: number;
  principal: number;
  payment: number;
  remainingBalance: number;
}

/** Monthly payment for a fixed-rate reducing-balance loan. */
export function monthlyPayment(p: number, monthlyRate: number, nMonths: number): number {
  if (monthlyRate === 0) return p / nMonths;
  return (p * monthlyRate * Math.pow(1 + monthlyRate, nMonths)) /
    (Math.pow(1 + monthlyRate, nMonths) - 1);
}

/** Full amortization schedule. */
export function amortize(input: LoanAmortizationInput): AmortizationRow[] {
  const monthlyRate = input.annualRate / 12;
  const payment = monthlyPayment(input.principal, monthlyRate, input.tenureMonths);
  const rows: AmortizationRow[] = [];
  let balance = input.principal;
  for (let m = 1; m <= input.tenureMonths; m++) {
    const interest = balance * monthlyRate;
    const principalPaid = payment - interest;
    balance -= principalPaid;
    if (balance < 0) balance = 0; // clamp final rounding
    rows.push({ month: m, interest, principal: principalPaid, payment, remainingBalance: balance });
  }
  return rows;
}
