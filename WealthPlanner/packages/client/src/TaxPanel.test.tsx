// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaxPanel } from "./TaxPanel";

const mocks = vi.hoisted(() => ({
  getTaxAnalysis: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getTaxAnalysis: mocks.getTaxAnalysis,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTaxAnalysis.mockResolvedValue({
    planId: "plan-1",
    totalCorpus: 3000000,
    swpRetentionRatio: 0.9,
    swp: { gross: 200000, tax: 20000, net: 180000 },
    lumpSumRetentionRatio: 0.85,
    lumpSum: { gross: 3000000, tax: 450000, net: 2550000 },
    verdict: "Systematic withdrawals preserve more post-tax corpus than a lump-sum draw.",
  });
});

describe("TaxPanel", () => {
  it("renders SWP and lump-sum metrics plus the verdict", async () => {
    render(<TaxPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByText("Tax")).toBeInTheDocument();
    expect(mocks.getTaxAnalysis).toHaveBeenCalledWith("plan-1");
    expect(screen.getByText(/Systematic withdrawals \(SWP\)/)).toBeInTheDocument();
    expect(screen.getByText(/Lump-sum drawdown/)).toBeInTheDocument();
    expect(screen.getAllByText(/Retention:/)).toHaveLength(2);
    expect(screen.getByText(/preserve more post-tax corpus/)).toBeInTheDocument();
  });
});
