// Shared domain types for the WealthPath engine.
//
// These types are deliberately jurisdiction-agnostic: they describe the nine
// abstract instrument types and the axes of variation on top of them, per
// docs/04-domain-model.md. No country name, currency symbol, or statutory
// number ever appears here — all of that lives in a Jurisdiction Pack.

import type { InstrumentType } from "@wealthpath/jurisdictions";

// The InstrumentType union is owned by @wealthpath/jurisdictions (the leaf
// data package); re-export it here so engine consumers can import from one
// place.
export type { InstrumentType } from "@wealthpath/jurisdictions";
export { INSTRUMENT_TYPES } from "@wealthpath/jurisdictions";

export type PositionStructure = "POOLED_BALANCE" | "DISCRETE_LOTS";

export type Liquidity = "LIQUID" | "LOCKED_STATUTORY" | "ILLIQUID_DISCRETIONARY";

export type LotSelectionMethod = "FIFO" | "LIFO" | "SPECIFIC_ID";

export interface Holder {
  id: string;
  name: string;
  relationshipToPlanOwner: string;
}

/** Discrete, dated, signed one-off amount against an account. */
export interface OneTimeAdjustment {
  id: string;
  date: string;
  amount: number; // signed: positive = addition, negative = withdrawal
  description?: string;
  linkedTransferRef?: string;
}

export interface Lot {
  id: string;
  ticker: string;
  quantity: number;
  acquisitionDate: string;
  acquisitionPricePerUnit: number;
  costBasisAdjustments?: CostBasisAdjustment[];
  disposals?: LotDisposal[];
}

export interface LotDisposal {
  id: string;
  date: string;
  quantity: number;
  pricePerUnit: number;
  realizedGain: number;
}

export interface CostBasisAdjustment {
  date: string;
  type: "SPLIT" | "SPIN_OFF" | "HARD_FORK" | "AIRDROP" | "OTHER";
  quantityMultiplier?: number;
  note: string;
}

export interface TermDepositPosition {
  id: string;
  principal: number;
  rate: number;
  maturityDate: string;
}

export interface SleeveAllocation {
  sleeve: string;
  weight: number; // 0..1
}

/** "Actual overrides Projected" reconciliation record. */
export interface ReconciliationEntry {
  periodEnd: string;
  actualBalance: number | null;
  projectedBalance: number | null;
}

export type ContributionRule =
  | { kind: "STATUTORY_SALARY_LINKED"; ruleRef: string }
  | { kind: "FIXED_PERIODIC"; amount: number; period: "MONTH" | "FISCAL_YEAR" }
  | { kind: "CAPPED_STATUTORY"; amount: number; period: "FISCAL_YEAR"; capRef: string }
  | { kind: "NONE" };

export type ROIRule =
  | { kind: "FLAT"; rate: number }
  | { kind: "STOCHASTIC"; mean: number; stdev: number }
  | { kind: "WEIGHTED_BLEND" }
  | { kind: "PER_POSITION" }
  | { kind: "DISCRETE_LOTS" };

export interface Account {
  id: string;
  label: string;
  instrumentType: InstrumentType;
  positionStructure: PositionStructure;
  liquidity: Liquidity;
  jurisdictionRuleRef: string;
  currency: string;
  openedDate: string;
  primaryHolderRef: string;
  jointHolderRefs?: string[];
  nomineeRef?: string;
  sleeves?: SleeveAllocation[];
  positions?: TermDepositPosition[];
  lots?: Lot[];
  lotSelectionMethod?: LotSelectionMethod;
  contributionRule: ContributionRule;
  roiRule: ROIRule;
  oneTimeAdjustments?: OneTimeAdjustment[];
  actualBalanceHistory?: ReconciliationEntry[];
  currentBalance: number;
  dataHealth?: { lastUpdated: string };
}

export interface Goal {
  id: string;
  label: string;
  costToday: number;
  costInflationRate: number;
  expectedRoi: number;
  currentSavingsEarmarked: number;
  targetYear?: number;
  beneficiaryName?: string;
  beneficiaryCurrentAge?: number;
  targetAge?: number;
  fundingAccounts?: { accountId: string; weight: number }[];
}

export interface Liability {
  id: string;
  label: string;
  principal: number;
  rate: number;
  tenureMonths: number;
  startDate: string;
}

export interface InsurancePolicy {
  id: string;
  type: string;
  coverInForce: number;
  annualIncome: number;
  familySize: number;
}

export interface EmergencyFundConfig {
  targetCoverageMonths: number;
  liquidBalance: number;
}

export interface MajorExpense {
  id: string;
  year: number;
  description: string;
  amountTodayValue: number;
}

/** The single "Assumptions tab" equivalent — every editable plan-level model. */
export interface PlanAssumptions {
  marketCagr: number;
  marketVolatility: number;
  stochasticMode: boolean;
  stochasticMethodology: "SINGLE_BLENDED" | "CORRELATED";
  inflationLongRunMean: number;
  inflationMeanReversionSpeed: number;
  inflationShockVolatility: number;
  inflationFloor: number;
  inflationCeiling: number;
  glideStartEquity: number;
  glideStep: number;
  glideFloor: number;
  lifestyleMultiplier: number;
  withdrawalWaterfallEnabled: boolean;
  freezeRandomSeed: boolean;
  rngSeed?: number;
  trialCount: number;
}

export interface OwnerProfile {
  dateOfBirth: string;
  targetRetirementAge: number;
  baseCurrency: string;
  homeJurisdiction: string;
}

export interface Plan {
  id: string;
  ownerProfile: OwnerProfile;
  jurisdictionPackId: string;
  holders: Holder[];
  accounts: Account[];
  goals: Goal[];
  liabilities: Liability[];
  insurancePolicies: InsurancePolicy[];
  emergencyFund: EmergencyFundConfig;
  majorExpenses: MajorExpense[];
  assumptions: PlanAssumptions;
}
