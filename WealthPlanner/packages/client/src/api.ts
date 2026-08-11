// TypeScript types mirroring the server's shared Zod schemas (Phase 5 client).
// Kept deliberately in sync with packages/server/src/api/schemas.ts.

export interface Plan {
  id: string;
  ownerName?: string | null;
  dateOfBirth: string;
  targetRetirementDate: string;
  baseCurrency: string;
  jurisdictionPackId: string;
  createdAt: string;
}

export interface CreatePlanInput {
  ownerName?: string;
  dateOfBirth: string;
  targetRetirementDate: string;
  baseCurrency: string;
  jurisdictionPackId: string;
}

export interface UpdatePlanInput {
  ownerName?: string;
  dateOfBirth?: string;
  targetRetirementDate?: string;
  baseCurrency?: string;
  jurisdictionPackId?: string;
}

export interface Account {
  id: string;
  planId: string;
  label: string;
  instrumentType: string;
  positionStructure: string;
  liquidity: string;
  jurisdictionRuleRef: string;
  currency: string;
  openedDate?: string | null;
  contributionRuleJson: string;
  roiRuleJson: string;
  currentBalance: number;
  bucketSplitJson?: string | null;
  lastUpdated?: string | null;
}

export interface CreateAccountInput {
  label: string;
  instrumentType: string;
  positionStructure: string;
  liquidity: string;
  jurisdictionRuleRef: string;
  currency: string;
  contributionRuleJson: string;
  roiRuleJson: string;
  currentBalance?: number;
  bucketSplitJson?: string;
}

export interface PlanAssumptions {
  planId: string;
  marketCagr: number;
  marketVolatility: number;
  stochasticMode: boolean;
  stochasticMethodology: string;
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
  rngSeed?: number | null;
  trialCount: number;
  targetAllocationJson?: string | null;
}

export interface UpsertAssumptionsInput {
  marketCagr: number;
  marketVolatility: number;
  stochasticMode: boolean;
  stochasticMethodology: string;
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
  rngSeed?: number | null;
  trialCount: number;
  targetAllocationJson?: string;
}

export interface Goal {
  id: string;
  planId: string;
  label: string;
  costToday: number;
  costInflationRate: number;
  expectedRoi: number;
  currentSavingsEarmarked: number;
  targetYear?: number | null;
  beneficiaryName?: string | null;
  beneficiaryCurrentAge?: number | null;
  targetAge?: number | null;
}

export interface CreateGoalInput {
  label: string;
  costToday: number;
  costInflationRate: number;
  expectedRoi: number;
  currentSavingsEarmarked?: number;
  targetYear?: number | null;
  beneficiaryName?: string | null;
  beneficiaryCurrentAge?: number | null;
  targetAge?: number | null;
}

export interface Liability {
  id: string;
  planId: string;
  label: string;
  principal: number;
  rate: number;
  tenureMonths: number;
  startDate: string;
}

export interface CreateLiabilityInput {
  label: string;
  principal: number;
  rate: number;
  tenureMonths: number;
  startDate: string;
}

export interface InsurancePolicy {
  id: string;
  planId: string;
  type: string;
  coverInForce: number;
  annualIncome: number;
  familySize: number;
}

export interface CreateInsuranceInput {
  type: string;
  coverInForce: number;
  annualIncome: number;
  familySize: number;
}

export interface MajorExpense {
  id: string;
  planId: string;
  year: number;
  description: string;
  amountTodayValue: number;
}

export interface CreateMajorExpenseInput {
  year: number;
  description: string;
  amountTodayValue: number;
}

export interface JurisdictionPackSummary {
  packId: string;
  displayName: string;
  currency: string;
  locale: string;
}

export interface JurisdictionInstrumentRule {
  instrumentType: string;
  displayLabel?: string;
}

export interface JurisdictionPack extends JurisdictionPackSummary {
  instrumentRules: Record<string, JurisdictionInstrumentRule>;
}

export interface PortfolioRiskBucket {
  bucket: string;
  label: string;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  rebalance: number;
}

export interface PortfolioRisk {
  planId: string;
  totalValue: number;
  variance: number;
  volatility: number;
  hhi: number;
  hasTarget: boolean;
  buckets: PortfolioRiskBucket[];
}

export interface ProjectionRow {
  year: number;
  expense: number;
  liquidBalance: number;
  lockedBalance: number;
  totalCorpus: number;
  weights: { EQUITY: number; GOLD: number; DEBT: number; CASH: number };
}

export interface Projection {
  planId: string;
  years: number;
  rows: ProjectionRow[];
}

export interface SequenceRiskReturnRow {
  yearIndex: number;
  annualReturn: number;
}

export interface SequenceRiskResult {
  forward: number;
  reversed: number;
  gap: number;
}

export interface SequenceRisk {
  returns: SequenceRiskReturnRow[];
  startingBalance: number;
  result: SequenceRiskResult | null;
}

export interface WithdrawalStrategy {
  planId: string;
  years: number;
  waterfallEnabled: boolean;
  waterfall: ProjectionRow[];
  pooled: ProjectionRow[];
  endingDifference: number;
}

export interface SensitivityAxis {
  label: string;
  values: number[];
}

export interface SensitivityMatrix {
  planId: string;
  x: SensitivityAxis;
  y: SensitivityAxis;
  rows: Array<Array<number | null>>;
  base: number;
}

export interface ScenarioOutcome {
  label: "best" | "base" | "worst";
  liquidReturn: number;
  lockedReturn: number;
  endingCorpus: number;
  deltaVsBase: number;
}

export interface ScenarioSet {
  planId: string;
  scenarios: ScenarioOutcome[];
  spread: number;
}

export type ActionSeverity = "OK" | "WARN" | "CRITICAL";

export interface Deadline {
  kind: string;
  label: string;
  date: string;
}

export interface ActionItem {
  id: string;
  message: string;
  severity: ActionSeverity;
  source: string;
}

export interface ActionItems {
  planId: string;
  deadlines: Deadline[];
  health: { account: string; stale: boolean; ageDays: number }[];
  actionItems: ActionItem[];
}

export interface TaxAnalysis {
  planId: string;
  totalCorpus: number;
  swpRetentionRatio: number;
  swp: { gross: number; tax: number; net: number };
  lumpSumRetentionRatio: number;
  lumpSum: { gross: number; tax: number; net: number };
  verdict: string;
}

export interface MonteCarloOutcome {
  cached: boolean;
  runId: string;
  result: {
    probabilityOfSuccess: number;
    median: number;
    min: number;
    max: number;
    curves: Array<{ year: number; P10: number; P50: number; P90: number }>;
  };
}

export interface HoldingLot {
  id: string;
  accountId: string;
  ticker: string;
  quantity: number;
  acquisitionDate: string;
  acquisitionPricePerUnit: number;
  remainingQuantity: number;
  disposals: Array<{
    id: string;
    lotId: string;
    date: string;
    quantity: number;
    pricePerUnit: number;
    realizedGain: number;
    realizedTax: number;
  }>;
}

export interface YieldIncomeEntry {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  description: string | null;
}

export interface HoldingsSummary {
  planId: string;
  accountId: string;
  lots: HoldingLot[];
  latestPrices: Record<string, number>;
  yieldEntries: YieldIncomeEntry[];
  currentValue: number;
}

export interface BuyLotInput {
  ticker: string;
  quantity: number;
  acquisitionDate: string;
  acquisitionPricePerUnit: number;
}

export interface SellInput {
  date: string;
  quantity: number;
  pricePerUnit: number;
}

export interface SellResult {
  disposals: HoldingLot["disposals"];
  totalGain: number;
  totalTax: number;
  currentValue: number;
}

export interface UpdatePriceInput {
  ticker: string;
  asOfDate: string;
  pricePerUnit: number;
}

export interface RecordYieldInput {
  date: string;
  amount: number;
  description?: string;
}

export interface ReconciliationRow {
  accountId: string;
  label: string;
  instrumentType: string;
  currentBalance: number;
}

export interface ReconciliationResult {
  periodEnd: string;
  reconciled: number;
  rows: Array<{ accountId: string; actualBalance: number; periodEnd: string }>;
}

export interface ReconciliationInput {
  periodEnd: string;
  rows: Array<{ accountId: string; actualBalance: number }>;
}

export interface EmergencyFundInputs {
  liquidBalance: number;
  inflationRate: number;
}

export interface EmergencyFundResult {
  planId: string;
  targetAmount: number;
  currentBalance: number;
  realValueAtEnd: number;
  gapAtEnd: number;
  onTarget: boolean;
  liquidBalance: number;
  inflationRate: number;
}

export interface EmergencyFundRequest {
  targetCoverageMonths: number;
  monthlyExpense: number;
}

export type AiProvider = "ANTHROPIC" | "OPENAI" | "CUSTOM";

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  customBaseUrl: string | null;
  /** Last four characters of the stored API key (the key is never returned). */
  keyLastFour: string | null;
}

export interface PutAiSettingsInput {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  customBaseUrl?: string;
  apiKey: string;
}

export interface TestAiConnectionInput {
  provider: AiProvider;
  model: string;
  customBaseUrl?: string;
  apiKey: string;
}

export type InsightType =
  | "PLAN_SUMMARY"
  | "MONTE_CARLO_INTERPRETATION"
  | "SENSITIVITY_SCENARIO_EXPLANATION"
  | "GOAL_PROGRESS_NARRATIVE"
  | "ACTION_ITEMS_PRIORITIZATION";

export interface AiInsight {
  id: string;
  planId: string;
  insightType: InsightType;
  generatedText: string;
  provider: string;
  model: string | null;
  generatedAt: string;
}

export interface GenerateInsightInput {
  insightType: InsightType;
  context?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error?: string; code?: string },
  ) {
    super(body.error ?? `Request failed (${status})`);
  }
}

/** Minimal typed fetch wrapper for the local API. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body as { error?: string; code?: string });
  return body as T;
}

export const api = {
  listPlans: () => request<Plan[]>("/plans"),
  createPlan: (input: CreatePlanInput) =>
    request<Plan>("/plans", { method: "POST", body: JSON.stringify(input) }),
  getPlan: (id: string) => request<Plan>(`/plans/${id}`),
  updatePlan: (id: string, input: UpdatePlanInput) =>
    request<Plan>(`/plans/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deletePlan: (id: string) =>
    request<void>(`/plans/${id}`, { method: "DELETE" }),
  listAccounts: (planId: string) => request<Account[]>(`/plans/${planId}/accounts`),
  createAccount: (planId: string, input: CreateAccountInput) =>
    request<Account>(`/plans/${planId}/accounts`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getAssumptions: (planId: string) => request<PlanAssumptions>(`/plans/${planId}/assumptions`),
  putAssumptions: (planId: string, input: UpsertAssumptionsInput) =>
    request<PlanAssumptions>(`/plans/${planId}/assumptions`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  listGoals: (planId: string) => request<Goal[]>(`/plans/${planId}/goals`),
  createGoal: (planId: string, input: CreateGoalInput) =>
    request<Goal>(`/plans/${planId}/goals`, { method: "POST", body: JSON.stringify(input) }),
  listLiabilities: (planId: string) =>
    request<Liability[]>(`/plans/${planId}/liabilities`),
  createLiability: (planId: string, input: CreateLiabilityInput) =>
    request<Liability>(`/plans/${planId}/liabilities`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listInsurance: (planId: string) => request<InsurancePolicy[]>(`/plans/${planId}/insurance`),
  createInsurance: (planId: string, input: CreateInsuranceInput) =>
    request<InsurancePolicy>(`/plans/${planId}/insurance`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listExpenses: (planId: string) => request<MajorExpense[]>(`/plans/${planId}/expenses`),
  createExpense: (planId: string, input: CreateMajorExpenseInput) =>
    request<MajorExpense>(`/plans/${planId}/expenses`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getPortfolioRisk: (planId: string) => request<PortfolioRisk>(`/plans/${planId}/portfolio-risk`),
  getProjection: (planId: string) => request<Projection>(`/plans/${planId}/projection`),
  getWithdrawalStrategies: (planId: string) =>
    request<WithdrawalStrategy>(`/plans/${planId}/withdrawal-strategies`),
  getSensitivityMatrix: (planId: string) =>
    request<SensitivityMatrix>(`/plans/${planId}/sensitivity-matrix`),
  getScenarioAnalysis: (planId: string) =>
    request<ScenarioSet>(`/plans/${planId}/scenario-analysis`),
  getActionItems: (planId: string) => request<ActionItems>(`/plans/${planId}/action-items`),
  getTaxAnalysis: (planId: string) => request<TaxAnalysis>(`/plans/${planId}/tax-analysis`),
  getSequenceRisk: (planId: string) =>
    request<SequenceRisk>(`/plans/${planId}/sequence-risk`),
  putSequenceRisk: (planId: string, returns: SequenceRiskReturnRow[]) =>
    request<SequenceRisk>(`/plans/${planId}/sequence-risk`, {
      method: "PUT",
      body: JSON.stringify({ returns }),
    }),
  listJurisdictionPacks: () => request<JurisdictionPackSummary[]>("/jurisdiction-packs"),
  getJurisdictionPack: (packId: string) =>
    request<JurisdictionPack>(`/jurisdiction-packs/${packId}`),
  runMonteCarlo: (planId: string, overrides?: Record<string, unknown>) =>
    request<MonteCarloOutcome>(`/plans/${planId}/monte-carlo`, {
      method: "POST",
      body: JSON.stringify({ engine: "SINGLE_BLENDED", overrides: overrides ?? {} }),
    }),
  getHoldings: (planId: string, accountId: string) =>
    request<HoldingsSummary>(`/plans/${planId}/holdings/${accountId}`),
  buyLot: (planId: string, accountId: string, input: BuyLotInput) =>
    request<{ lot: HoldingLot; currentValue: number }>(`/plans/${planId}/holdings/${accountId}/lots`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  sell: (planId: string, accountId: string, input: SellInput) =>
    request<SellResult>(`/plans/${planId}/holdings/${accountId}/sell`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePrice: (planId: string, accountId: string, input: UpdatePriceInput) =>
    request<{ priceEntry: { id: string; ticker: string; asOfDate: string; pricePerUnit: number }; currentValue: number }>(
      `/plans/${planId}/holdings/${accountId}/prices`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  recordYield: (planId: string, accountId: string, input: RecordYieldInput) =>
    request<YieldIncomeEntry>(`/plans/${planId}/holdings/${accountId}/yield`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getReconciliation: (planId: string) =>
    request<ReconciliationRow[]>(`/plans/${planId}/reconciliation`),
  putReconciliation: (planId: string, input: ReconciliationInput) =>
    request<ReconciliationResult>(`/plans/${planId}/reconciliation`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  getEmergencyFundInputs: (planId: string) =>
    request<EmergencyFundInputs>(`/plans/${planId}/emergency-fund`),
  assessEmergencyFund: (planId: string, input: EmergencyFundRequest) =>
    request<EmergencyFundResult>(`/plans/${planId}/emergency-fund`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getAiSettings: () => request<AiSettings | null>("/ai-settings"),
  putAiSettings: (input: PutAiSettingsInput) =>
    request<AiSettings>("/ai-settings", { method: "PUT", body: JSON.stringify(input) }),
  deleteAiSettings: () => request<void>("/ai-settings", { method: "DELETE" }),
  testAiConnection: (input: TestAiConnectionInput) =>
    request<{ ok: boolean }>("/ai/test", { method: "POST", body: JSON.stringify(input) }),
  listInsights: (planId: string) => request<AiInsight[]>(`/plans/${planId}/insights`),
  generateInsight: (planId: string, input: GenerateInsightInput) =>
    request<AiInsight>(`/plans/${planId}/insights/generate`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export interface MonteCarloProgress {
  completedTrials: number;
  totalTrials: number;
}

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Parses a single SSE event block (the lines between two blank lines) into its
 * `event` name and `data` payload. Defaults the event name to "message" and
 * concatenates any repeated `data:` lines, matching the SSE spec.
 */
export function parseSseEventBlock(block: string): SseEvent {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  return { event, data };
}

/**
 * Runs a Monte Carlo simulation over the SSE endpoint, invoking `onProgress`
 * for every progress event and resolving with the final outcome. Keeps the
 * POST-with-Accept:text/event-stream shape used by the server route.
 */
export async function runMonteCarloStream(
  planId: string,
  overrides: Record<string, unknown>,
  onProgress: (p: MonteCarloProgress) => void,
): Promise<MonteCarloOutcome> {
  const res = await fetch(`/plans/${planId}/monte-carlo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ engine: "SINGLE_BLENDED", overrides }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, { error: `Request failed (${res.status})` });
  }
  if (!res.body) throw new ApiError(0, { error: "No response body" });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outcome: MonteCarloOutcome | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const { event, data } = parseSseEventBlock(block);
      if (!data) {
        sep = buffer.indexOf("\n\n");
        continue;
      }
      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (event === "progress") {
        onProgress(parsed as unknown as MonteCarloProgress);
      } else if (event === "result") {
        outcome = parsed as unknown as MonteCarloOutcome;
      } else if (event === "error") {
        throw new ApiError(0, { error: String(parsed.message ?? "Monte Carlo failed") });
      }
      sep = buffer.indexOf("\n\n");
    }
  }

  if (!outcome) throw new ApiError(0, { error: "Stream ended without a result" });
  return outcome;
}
