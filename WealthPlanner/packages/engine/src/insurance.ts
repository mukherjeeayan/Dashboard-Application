// Insurance adequacy (docs/06 §6.8, source §3.14). Recommended-cover defaults
// come from the Jurisdiction Pack (income-replacement years, base cover per
// person). Current cover in force is the SUM of actual policy records — not a
// single formula, to avoid the source workbook's copy-paste bug (docs/14 C6).

export interface InsuranceDefaults {
  incomeReplacementYearsTermLife: number;
  healthBaseCoverPerPerson: number;
  elderlyHealthCoverMultiplier: number;
}

export interface PolicyCover {
  type: string;
  coverInForce: number;
  annualIncome?: number;
  familySize?: number;
}

export interface InsuranceInput {
  annualIncome: number;
  familySize: number;
  defaults: InsuranceDefaults;
  policies: PolicyCover[];
}

export interface InsuranceResult {
  recommendedTermCover: number;
  recommendedHealthCover: number;
  currentCoverInForce: number;
  termGap: number;
  healthGap: number;
}

export function assessInsurance(input: InsuranceInput): InsuranceResult {
  const recommendedTermCover = input.defaults.incomeReplacementYearsTermLife * input.annualIncome;
  const recommendedHealthCover =
    input.defaults.healthBaseCoverPerPerson * input.familySize;

  // Current cover = sum of actual policy cover amounts (docs/14 C6).
  const currentCoverInForce = input.policies.reduce((s, p) => s + p.coverInForce, 0);

  return {
    recommendedTermCover,
    recommendedHealthCover,
    currentCoverInForce,
    termGap: Math.max(0, recommendedTermCover - currentCoverInForce),
    healthGap: Math.max(0, recommendedHealthCover - currentCoverInForce),
  };
}
