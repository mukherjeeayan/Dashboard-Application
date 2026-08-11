// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HoldingsPanel } from "./HoldingsPanel";

const mocks = vi.hoisted(() => ({
  getHoldings: vi.fn(),
  buyLot: vi.fn(),
  sell: vi.fn(),
  updatePrice: vi.fn(),
  recordYield: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getHoldings: mocks.getHoldings,
    buyLot: mocks.buyLot,
    sell: mocks.sell,
    updatePrice: mocks.updatePrice,
    recordYield: mocks.recordYield,
  },
}));

const base = {
  planId: "plan-1",
  accountId: "acct-1",
  lots: [
    {
      id: "lot-1",
      accountId: "acct-1",
      ticker: "TATAMOTORS",
      quantity: 100,
      acquisitionDate: "2025-01-10",
      acquisitionPricePerUnit: 400,
      remainingQuantity: 100,
      disposals: [],
    },
  ],
  latestPrices: { TATAMOTORS: 450 },
  yieldEntries: [],
  currentValue: 45000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getHoldings.mockResolvedValue(JSON.parse(JSON.stringify(base)));
  mocks.buyLot.mockResolvedValue({ lot: {}, currentValue: 0 });
  mocks.sell.mockResolvedValue({ disposals: [], totalGain: 2000, totalTax: 0, currentValue: 27000 });
  mocks.updatePrice.mockResolvedValue({ priceEntry: {}, currentValue: 45000 });
  mocks.recordYield.mockResolvedValue({ id: "y-1", accountId: "acct-1", date: "2026-07-01", amount: 1500, description: null });
});

describe("HoldingsPanel", () => {
  it("loads and renders the holdings summary with lots", async () => {
    render(<HoldingsPanel planId="plan-1" accountId="acct-1" label="Stocks" currency="INR" />);

    expect(await screen.findByText("TATAMOTORS")).toBeInTheDocument();
    expect(screen.getByText("Holdings — Stocks")).toBeInTheDocument();
    expect(screen.getByText(/Account value/)).toBeInTheDocument();
    expect(mocks.getHoldings).toHaveBeenCalledWith("plan-1", "acct-1");
  });

  it("sells a lot and shows the realized gain", async () => {
    const user = userEvent.setup();
    render(<HoldingsPanel planId="plan-1" accountId="acct-1" label="Stocks" currency="INR" />);
    await screen.findByText("TATAMOTORS");

    await user.type(screen.getByLabelText("Sell quantity"), "40");
    await user.type(screen.getByLabelText("Sell price per unit"), "450");
    await user.click(screen.getByRole("button", { name: "Sell" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalled());
    expect(mocks.sell).toHaveBeenCalledWith("plan-1", "acct-1", {
      date: "",
      quantity: 40,
      pricePerUnit: 450,
    });
    expect(await screen.findByText(/Realized gain/)).toBeInTheDocument();
  });
});
