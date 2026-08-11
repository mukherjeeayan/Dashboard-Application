// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReconciliationPanel } from "./ReconciliationPanel";

const mocks = vi.hoisted(() => ({
  getReconciliation: vi.fn(),
  putReconciliation: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getReconciliation: mocks.getReconciliation,
    putReconciliation: mocks.putReconciliation,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getReconciliation.mockResolvedValue([
    { accountId: "a1", label: "Savings", instrumentType: "LIQUID_CASH", currentBalance: 150_000 },
    { accountId: "a2", label: "Stocks", instrumentType: "MARKET_LINKED_DIRECT", currentBalance: 27_000 },
  ]);
  mocks.putReconciliation.mockResolvedValue({
    periodEnd: "2026-08-31",
    reconciled: 2,
    rows: [],
  });
});

describe("ReconciliationPanel", () => {
  it("loads accounts and prefills their current balances", async () => {
    render(<ReconciliationPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByText("Savings")).toBeInTheDocument();
    expect(screen.getByText("Stocks")).toBeInTheDocument();
    expect(mocks.getReconciliation).toHaveBeenCalledWith("plan-1");
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(inputs.some((i) => i.value === "150000")).toBe(true);
  });

  it("submits edited balances", async () => {
    const user = userEvent.setup();
    render(<ReconciliationPanel planId="plan-1" currency="INR" />);
    await screen.findByText("Savings");

    await user.click(screen.getByRole("button", { name: "Save reconciliation" }));

    await waitFor(() => expect(mocks.putReconciliation).toHaveBeenCalled());
    expect(mocks.putReconciliation).toHaveBeenCalledWith("plan-1", {
      periodEnd: expect.any(String),
      rows: [
        { accountId: "a1", actualBalance: 150000 },
        { accountId: "a2", actualBalance: 27000 },
      ],
    });
    expect(screen.getByText(/Reconciled 2 account/)).toBeInTheDocument();
  });
});
