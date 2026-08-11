// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmergencyFundPanel } from "./EmergencyFundPanel";

const mocks = vi.hoisted(() => ({
  getEmergencyFundInputs: vi.fn(),
  assessEmergencyFund: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getEmergencyFundInputs: mocks.getEmergencyFundInputs,
    assessEmergencyFund: mocks.assessEmergencyFund,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEmergencyFundInputs.mockResolvedValue({ liquidBalance: 150_000, inflationRate: 0.075 });
  mocks.assessEmergencyFund.mockResolvedValue({
    planId: "plan-1",
    targetAmount: 300_000,
    currentBalance: 150_000,
    realValueAtEnd: 150_000,
    gapAtEnd: 150_000,
    onTarget: false,
    liquidBalance: 150_000,
    inflationRate: 0.075,
  });
});

describe("EmergencyFundPanel", () => {
  it("loads and shows the liquid balance prefill", async () => {
    render(<EmergencyFundPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByText(/liquid balance is/)).toBeInTheDocument();
    expect(screen.getByText("Emergency Fund")).toBeInTheDocument();
    expect(mocks.getEmergencyFundInputs).toHaveBeenCalledWith("plan-1");
  });

  it("assesses the fund against the entered coverage target", async () => {
    const user = userEvent.setup();
    render(<EmergencyFundPanel planId="plan-1" currency="INR" />);
    await screen.findByText(/liquid balance is/);

    await user.type(screen.getByLabelText("Monthly expense"), "50000");
    await user.click(screen.getByRole("button", { name: "Assess" }));

    await waitFor(() => expect(mocks.assessEmergencyFund).toHaveBeenCalled());
    expect(mocks.assessEmergencyFund).toHaveBeenCalledWith("plan-1", {
      targetCoverageMonths: 6,
      monthlyExpense: 50000,
    });
    expect(await screen.findByText("Target amount")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });
});
