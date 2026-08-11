// EMPLOYER_MANDATORY_LOCKED: composed contribution from three sources with a
// "capped total, voluntary as plug" mode once the annual tax-free interest
// threshold binds (docs/15 §15.3.2). This is a distinct ContributionRule mode —
// not just independent per-source formulas — to reproduce the workbook exactly.

export interface PFConfig {
  monthlyBasicSalary: number;
  employeeRate: number; // 0.12
  employerRate: number; // 0.12
  employerDiversionCapPerMonth: number; // 1250 (EPS pension)
  voluntaryRate: number; // 0.28
  salaryGrowthRate: number; // 0.02
  annualTaxFreeThreshold: number; // 250,000
  declaredRate: number; // 0.0825
}

export interface PFYearResult {
  employee: number;
  employer: number;
  voluntary: number;
  total: number;
  closingBalance: number;
}

export interface PFConfigResolved extends PFConfig {
  /** Monthly basic salary at the start year (2024). */
  monthlyBasicSalaryStart: number;
}

/**
 * Computes one year of PF contribution and closing balance.
 * `priorBalance` is the balance carried in from the previous year; `yearIndex`
 * counts full contribution years from 1; `runningPriorContribution` is the
 * cumulative total of contributions made in all PRIOR years. Employee/voluntary
 * grow with the salary growth rate each year. Once the RUNNING total of
 * contributions to date exceeds the annual tax-free interest threshold
 * (₹2.5L under Rule 9D, Finance Act 2021 — interest on contributions above the
 * threshold becomes taxable), total is capped at the threshold and the
 * voluntary component becomes the plug. The threshold is checked against
 * prior years' contributions so the first full contribution year (which has no
 * prior running total) stays uncapped, matching docs/15 §15.3.2.
 */
export function pfYear(
  config: PFConfig,
  priorBalance: number,
  yearIndex: number,
  runningPriorContribution: number,
): PFYearResult {
  // Salary grows each full contribution year; year 1 uses the base salary.
  const monthlySalary = config.monthlyBasicSalary * Math.pow(1 + config.salaryGrowthRate, yearIndex - 1);

  const employee = config.employeeRate * monthlySalary * 12;
  const employer = (config.employerRate * monthlySalary - config.employerDiversionCapPerMonth) * 12;
  let voluntary = config.voluntaryRate * monthlySalary * 12;

  let total = employee + employer + voluntary;
  if (runningPriorContribution > config.annualTaxFreeThreshold) {
    // Cap total at the threshold; voluntary is the plug.
    total = config.annualTaxFreeThreshold;
    voluntary = total - employee - employer;
  }

  const closingBalance = priorBalance * (1 + config.declaredRate) + total;
  return { employee, employer, voluntary, total, closingBalance };
}

/**
 * Projects an EMPLOYER_MANDATORY_LOCKED account over `years` full contribution
 * years, returning a per-year breakdown.
 */
export function projectEmployerMandatoryLocked(
  config: PFConfig,
  openingBalance: number,
  years: number,
): PFYearResult[] {
  const results: PFYearResult[] = [];
  let balance = openingBalance;
  let runningPriorContribution = 0;
  for (let y = 1; y <= years; y++) {
    const r = pfYear(config, balance, y, runningPriorContribution);
    results.push(r);
    runningPriorContribution += r.total;
    balance = r.closingBalance;
  }
  return results;
}
