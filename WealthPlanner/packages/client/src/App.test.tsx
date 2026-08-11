// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import type { Plan, MonteCarloOutcome } from "./api";

const mocks = vi.hoisted(() => ({
  listPlans: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  listAccounts: vi.fn(),
  listGoals: vi.fn(),
  getPortfolioRisk: vi.fn(),
  createAccount: vi.fn(),
  getAssumptions: vi.fn(),
  putAssumptions: vi.fn(),
  listLiabilities: vi.fn(),
  listInsurance: vi.fn(),
  listExpenses: vi.fn(),
  createGoal: vi.fn(),
  createLiability: vi.fn(),
  createInsurance: vi.fn(),
  createExpense: vi.fn(),
  getProjection: vi.fn(),
  getSequenceRisk: vi.fn(),
  putSequenceRisk: vi.fn(),
  getWithdrawalStrategies: vi.fn(),
  getSensitivityMatrix: vi.fn(),
  getScenarioAnalysis: vi.fn(),
  getActionItems: vi.fn(),
  getTaxAnalysis: vi.fn(),
  listJurisdictionPacks: vi.fn(),
  getJurisdictionPack: vi.fn(),
  runMonteCarloStream: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    listPlans: mocks.listPlans,
    createPlan: mocks.createPlan,
    updatePlan: mocks.updatePlan,
    deletePlan: mocks.deletePlan,
    listAccounts: mocks.listAccounts,
    listGoals: mocks.listGoals,
    getPortfolioRisk: mocks.getPortfolioRisk,
    createAccount: mocks.createAccount,
    getAssumptions: mocks.getAssumptions,
    putAssumptions: mocks.putAssumptions,
    listLiabilities: mocks.listLiabilities,
    listInsurance: mocks.listInsurance,
    listExpenses: mocks.listExpenses,
    createGoal: mocks.createGoal,
    createLiability: mocks.createLiability,
    createInsurance: mocks.createInsurance,
    createExpense: mocks.createExpense,
    getProjection: mocks.getProjection,
    getSequenceRisk: mocks.getSequenceRisk,
    putSequenceRisk: mocks.putSequenceRisk,
    getWithdrawalStrategies: mocks.getWithdrawalStrategies,
    getSensitivityMatrix: mocks.getSensitivityMatrix,
    getScenarioAnalysis: mocks.getScenarioAnalysis,
    getActionItems: mocks.getActionItems,
    getTaxAnalysis: mocks.getTaxAnalysis,
    listJurisdictionPacks: mocks.listJurisdictionPacks,
    getJurisdictionPack: mocks.getJurisdictionPack,
  },
  runMonteCarloStream: mocks.runMonteCarloStream,
}));

const PLAN: Plan = {
  id: "plan-abc123",
  ownerName: "Aya",
  dateOfBirth: "1986-05-10",
  targetRetirementDate: "2060-01-01",
  baseCurrency: "INR",
  jurisdictionPackId: "IN-2025",
  createdAt: "2026-01-01T00:00:00Z",
};

const OUTCOME: MonteCarloOutcome = {
  cached: false,
  runId: "run-1",
  result: {
    probabilityOfSuccess: 0.96,
    median: 5_000_000,
    min: -1000,
    max: 2e10,
    curves: [
      { year: 1, P10: 100, P50: 110, P90: 120 },
      { year: 2, P10: 90, P50: 121, P90: 150 },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listJurisdictionPacks.mockResolvedValue([
    { packId: "IN-2025", displayName: "India", currency: "INR", locale: "en-IN" },
  ]);
  mocks.getJurisdictionPack.mockResolvedValue({
    packId: "IN-2025",
    displayName: "India",
    currency: "INR",
    locale: "en-IN",
    instrumentRules: {
      MF: { instrumentType: "MARKET_LINKED_POOLED", displayLabel: "Mutual Fund" },
    },
  });
  mocks.listAccounts.mockResolvedValue([]);
  mocks.listGoals.mockResolvedValue([]);
  mocks.getPortfolioRisk.mockResolvedValue({
    planId: "plan-abc123",
    totalValue: 1_000_000,
    variance: 0.0123,
    volatility: 0.111,
    hhi: 0.58,
    hasTarget: false,
    buckets: [
      { bucket: "EQUITY", label: "Equity", currentValue: 700_000, currentWeight: 0.7, targetWeight: 0.7, rebalance: 0 },
      { bucket: "GOLD", label: "Gold & alternatives", currentValue: 0, currentWeight: 0, targetWeight: 0, rebalance: 0 },
      { bucket: "DEBT", label: "Debt", currentValue: 300_000, currentWeight: 0.3, targetWeight: 0.3, rebalance: 0 },
      { bucket: "CASH", label: "Cash", currentValue: 0, currentWeight: 0, targetWeight: 0, rebalance: 0 },
    ],
  });
  mocks.getAssumptions.mockResolvedValue({
    planId: "plan-abc123",
    marketCagr: 0.12,
    marketVolatility: 0.2,
    stochasticMode: true,
    stochasticMethodology: "lognormal",
    inflationLongRunMean: 0.075,
    inflationMeanReversionSpeed: 0.2,
    inflationShockVolatility: 0.05,
    inflationFloor: 0,
    inflationCeiling: 0.15,
    glideStartEquity: 0.7,
    glideStep: 0.02,
    glideFloor: 0.3,
    lifestyleMultiplier: 1,
    withdrawalWaterfallEnabled: true,
    freezeRandomSeed: true,
    trialCount: 1000,
    targetAllocationJson: undefined,
  });
  mocks.createAccount.mockResolvedValue({ id: "acct-1" });
  mocks.putAssumptions.mockResolvedValue({});
  mocks.listLiabilities.mockResolvedValue([]);
  mocks.listInsurance.mockResolvedValue([]);
  mocks.listExpenses.mockResolvedValue([]);
  mocks.getSequenceRisk.mockResolvedValue({
    returns: [],
    startingBalance: 0,
    result: null,
  });
  mocks.putSequenceRisk.mockResolvedValue({
    returns: [],
    startingBalance: 0,
    result: null,
  });
  mocks.getWithdrawalStrategies.mockResolvedValue({
    planId: "plan-abc123",
    years: 2,
    waterfallEnabled: true,
    waterfall: [
      { year: 1, expense: 500000, liquidBalance: 1740000, lockedBalance: 1070000, totalCorpus: 2810000, weights: { EQUITY: 0.7, GOLD: 0.1, DEBT: 0.2, CASH: 0 } },
      { year: 2, expense: 537500, liquidBalance: 1500000, lockedBalance: 1144900, totalCorpus: 2644900, weights: { EQUITY: 0.68, GOLD: 0.1, DEBT: 0.22, CASH: 0 } },
    ],
    pooled: [
      { year: 1, expense: 500000, liquidBalance: 1740000, lockedBalance: 1070000, totalCorpus: 2810000, weights: { EQUITY: 0.7, GOLD: 0.1, DEBT: 0.2, CASH: 0 } },
      { year: 2, expense: 537500, liquidBalance: 1600000, lockedBalance: 1044900, totalCorpus: 2644900, weights: { EQUITY: 0.68, GOLD: 0.1, DEBT: 0.22, CASH: 0 } },
    ],
    endingDifference: 0,
  });
  mocks.getSensitivityMatrix.mockResolvedValue({
    planId: "plan-abc123",
    x: { label: "Liquid return", values: [0.08, 0.12, 0.16] },
    y: { label: "Locked return", values: [0.05, 0.07, 0.09] },
    rows: [[1000000, 1500000, 2000000], [1100000, 1600000, 2100000], [1200000, 1700000, 2200000]],
    base: 1600000,
  });
  mocks.getScenarioAnalysis.mockResolvedValue({
    planId: "plan-abc123",
    scenarios: [
      { label: "best", liquidReturn: 0.15, lockedReturn: 0.077, endingCorpus: 2000000, deltaVsBase: 400000 },
      { label: "base", liquidReturn: 0.12, lockedReturn: 0.07, endingCorpus: 1600000, deltaVsBase: 0 },
      { label: "worst", liquidReturn: 0.09, lockedReturn: 0.063, endingCorpus: 1200000, deltaVsBase: -400000 },
    ],
    spread: 800000,
  });
  mocks.getActionItems.mockResolvedValue({
    planId: "plan-abc123",
    deadlines: [{ kind: "LOCKED_EXTENSION", label: "PPF", date: "2027-01-01" }],
    health: [{ account: "Mutual fund", stale: false, ageDays: 10 }],
    actionItems: [{ id: "a1", message: "Reconcile Mutual fund", severity: "WARN", source: "data-health" }],
  });
  mocks.getTaxAnalysis.mockResolvedValue({
    planId: "plan-abc123",
    totalCorpus: 3000000,
    swpRetentionRatio: 0.9,
    swp: { gross: 200000, tax: 20000, net: 180000 },
    lumpSumRetentionRatio: 0.85,
    lumpSum: { gross: 3000000, tax: 450000, net: 2550000 },
    verdict: "Systematic withdrawals preserve more post-tax corpus than a lump-sum draw.",
  });
  mocks.getProjection.mockResolvedValue({
    planId: "plan-abc123",
    years: 2,
    rows: [
      {
        year: 1,
        expense: 500000,
        liquidBalance: 1740000,
        lockedBalance: 1070000,
        totalCorpus: 2810000,
        weights: { EQUITY: 0.7, GOLD: 0.1, DEBT: 0.2, CASH: 0 },
      },
      {
        year: 2,
        expense: 537500,
        liquidBalance: 1500000,
        lockedBalance: 1144900,
        totalCorpus: 2644900,
        weights: { EQUITY: 0.68, GOLD: 0.1, DEBT: 0.22, CASH: 0 },
      },
    ],
  });
});

describe("App", () => {
  it("renders the plan list and selects a plan", async () => {
    mocks.listPlans.mockResolvedValue([PLAN]);
    render(<App />);

    expect(await screen.findByText(/Aya/)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Aya/));
    expect(await screen.findByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(mocks.listAccounts).toHaveBeenCalledWith("plan-abc123");
  });

  it("creates a new plan from the form", async () => {
    mocks.listPlans.mockResolvedValue([]);
    mocks.createPlan.mockResolvedValue(PLAN);
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText("Owner name"), "Aya");
    await user.selectOptions(screen.getByRole("combobox"), "IN-2025");
    fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: "1986-05-10" } });
    fireEvent.change(screen.getByLabelText(/Target retirement/i), { target: { value: "2060-01-01" } });
    await user.click(screen.getByRole("button", { name: "Create plan" }));

    await waitFor(() => expect(mocks.createPlan).toHaveBeenCalled());
    expect(mocks.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ jurisdictionPackId: "IN-2025" }),
    );
  });

  it("runs Monte Carlo and shows the success stat and fan chart", async () => {
    mocks.listPlans.mockResolvedValue([PLAN]);
    mocks.runMonteCarloStream.mockImplementation(
      async (_planId: string, _o: unknown, onProgress: (p: { completedTrials: number; totalTrials: number }) => void) => {
        onProgress({ completedTrials: 50, totalTrials: 100 });
        return OUTCOME;
      },
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText(/Aya/));
    await user.click(await screen.findByRole("button", { name: /Run Monte Carlo/ }));

    expect(await screen.findByText(/96\.0%/)).toBeInTheDocument();
    expect(screen.getByText("Monte Carlo projection")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /fan chart/i })).toBeInTheDocument();
  });

  it("renders the Portfolio Risk panel for a selected plan", async () => {
    mocks.listPlans.mockResolvedValue([PLAN]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText(/Aya/));

    expect(await screen.findByText("Portfolio Risk")).toBeInTheDocument();
    expect(mocks.getPortfolioRisk).toHaveBeenCalledWith("plan-abc123");
    // Volatility 11.1% renders as a percentage, HHI as a 3-decimal number.
    expect(screen.getByText("11.1%")).toBeInTheDocument();
    expect(screen.getByText("0.580")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Equity" })).toBeInTheDocument();
  });

  it("adds an account with a chosen risk bucket", async () => {
    mocks.listPlans.mockResolvedValue([PLAN]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText(/Aya/));
    await user.click(await screen.findByRole("tab", { name: "Accounts & Holdings" }));
    await user.type(screen.getByPlaceholderText(/Label/), "NPS Tier 1");
    await user.selectOptions(screen.getByLabelText(/Risk bucket/), "EQUITY");
    await user.type(screen.getByPlaceholderText("Balance"), "500000");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(mocks.createAccount).toHaveBeenCalled());
    expect(mocks.createAccount).toHaveBeenCalledWith(
      "plan-abc123",
      expect.objectContaining({
        instrumentType: "MARKET_LINKED_POOLED",
        currentBalance: 500000,
        bucketSplitJson: JSON.stringify({ EQUITY: 1 }),
      }),
    );
  });

  it("drives account entry from the jurisdiction pack's instrument labels", async () => {
    mocks.listPlans.mockResolvedValue([PLAN]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText(/Aya/));
    await user.click(await screen.findByRole("tab", { name: "Accounts & Holdings" }));
    // Pack is loaded: the instrument dropdown exposes the pack's named
    // instrument ("Mutual Fund") rather than the generic instrument type.
    await waitFor(() => expect(screen.getByLabelText("Instrument")).toHaveValue("MF"));
    expect(screen.getByText("Mutual Fund")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Label/), "Index fund");
    await user.type(screen.getByPlaceholderText("Balance"), "300000");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(mocks.createAccount).toHaveBeenCalled());
    expect(mocks.createAccount).toHaveBeenCalledWith(
      "plan-abc123",
      expect.objectContaining({
        instrumentType: "MARKET_LINKED_POOLED",
        jurisdictionRuleRef: "MF",
      }),
    );
  });

  it("saves a target allocation to assumptions", async () => {
    mocks.listPlans.mockResolvedValue([PLAN]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText(/Aya/));
    await user.click(await screen.findByRole("tab", { name: "Accounts & Holdings" }));
    await user.clear(screen.getByLabelText(/EQUITY/));
    await user.type(screen.getByLabelText(/EQUITY/), "50");
    await user.clear(screen.getByLabelText(/DEBT/));
    await user.type(screen.getByLabelText(/DEBT/), "50");
    await user.click(screen.getByRole("button", { name: "Save target allocation" }));

    await waitFor(() => expect(mocks.putAssumptions).toHaveBeenCalled());
    expect(mocks.putAssumptions).toHaveBeenCalledWith(
      "plan-abc123",
      expect.objectContaining({ targetAllocationJson: JSON.stringify({ EQUITY: 0.5, DEBT: 0.5 }) }),
    );
  });

  it("edits a selected plan's fields and saves them", async () => {
    mocks.listPlans.mockResolvedValue([PLAN]);
    mocks.updatePlan.mockResolvedValue({
      ...PLAN,
      ownerName: "Aya Updated",
      dateOfBirth: "1987-01-01",
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText(/Aya/));
    await user.click(await screen.findByRole("button", { name: "Edit plan" }));
    const nameInput = screen.getAllByPlaceholderText("Owner name").at(-1) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Aya Updated");
    const dobInput = screen.getAllByLabelText(/Date of birth/i).at(-1) as HTMLInputElement;
    await fireEvent.change(dobInput, { target: { value: "1987-01-01" } }); 
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocks.updatePlan).toHaveBeenCalled());
    expect(mocks.updatePlan).toHaveBeenCalledWith(
      "plan-abc123",
      expect.objectContaining({ ownerName: "Aya Updated", dateOfBirth: "1987-01-01" }),
    );
    expect(await screen.findByText("Plan updated.")).toBeInTheDocument();
  });

  it("deletes a selected plan after confirmation", async () => {
    mocks.listPlans.mockResolvedValue([PLAN]);
    mocks.deletePlan.mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText(/Aya/));
    await user.click(screen.getByRole("button", { name: "Delete plan" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete?" }));

    await waitFor(() => expect(mocks.deletePlan).toHaveBeenCalledWith("plan-abc123"));
    expect(screen.queryByRole("button", { name: /Delete plan/ })).not.toBeInTheDocument();
  });
});
