// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WithdrawalStrategyPanel } from "./WithdrawalStrategyPanel";

const mocks = vi.hoisted(() => ({
  getWithdrawalStrategies: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getWithdrawalStrategies: mocks.getWithdrawalStrategies,
  },
}));

const ROWS = [
  { year: 1, expense: 500000, liquidBalance: 1740000, lockedBalance: 1070000, totalCorpus: 2810000, weights: { EQUITY: 0.7, GOLD: 0.1, DEBT: 0.2, CASH: 0 } },
  { year: 2, expense: 537500, liquidBalance: 1500000, lockedBalance: 1144900, totalCorpus: 2644900, weights: { EQUITY: 0.68, GOLD: 0.1, DEBT: 0.22, CASH: 0 } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getWithdrawalStrategies.mockResolvedValue({
    planId: "plan-1",
    years: 2,
    waterfallEnabled: true,
    waterfall: ROWS,
    pooled: ROWS.map((r, i) => ({ ...r, totalCorpus: r.totalCorpus + (i === 1 ? 10000 : 0) })),
    endingDifference: 10000,
  });
});

describe("WithdrawalStrategyPanel", () => {
  it("loads and renders the comparison chart and verdict", async () => {
    render(<WithdrawalStrategyPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByRole("img", { name: /withdrawal waterfall vs pooled draw/ })).toBeInTheDocument();
    expect(screen.getByText("Withdrawal Strategy")).toBeInTheDocument();
    expect(mocks.getWithdrawalStrategies).toHaveBeenCalledWith("plan-1");
    expect(screen.getByText(/statutory ordering rules preserve/)).toBeInTheDocument();
  });

  it("flags when the waterfall is disabled in assumptions", async () => {
    mocks.getWithdrawalStrategies.mockResolvedValue({
      planId: "plan-1",
      years: 2,
      waterfallEnabled: false,
      waterfall: ROWS,
      pooled: ROWS,
      endingDifference: 0,
    });
    render(<WithdrawalStrategyPanel planId="plan-1" currency="INR" />);

    await screen.findByRole("img");
    expect(screen.getByText(/currently disabled in this plan's assumptions/)).toBeInTheDocument();
  });
});
