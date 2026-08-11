// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SequenceRiskPanel } from "./SequenceRiskPanel";

const mocks = vi.hoisted(() => ({
  getSequenceRisk: vi.fn(),
  putSequenceRisk: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getSequenceRisk: mocks.getSequenceRisk,
    putSequenceRisk: mocks.putSequenceRisk,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSequenceRisk.mockResolvedValue({
    returns: [
      { yearIndex: 0, annualReturn: 0.3 },
      { yearIndex: 1, annualReturn: -0.1 },
    ],
    startingBalance: 1_000_000,
    result: { forward: 1_170_000, reversed: 1_170_000, gap: 0 },
  });
  mocks.putSequenceRisk.mockResolvedValue({
    returns: [{ yearIndex: 0, annualReturn: 0.3 }],
    startingBalance: 1_000_000,
    result: { forward: 1_300_000, reversed: 1_300_000, gap: 0 },
  });
});

describe("SequenceRiskPanel", () => {
  it("loads stored returns and renders the dual-order chart + gap", async () => {
    render(<SequenceRiskPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByRole("img", { name: /dual-order chart/ })).toBeInTheDocument();
    expect(screen.getByText("Sequence Risk")).toBeInTheDocument();
    expect(mocks.getSequenceRisk).toHaveBeenCalledWith("plan-1");
    expect(screen.getByText(/sequencing gap/)).toBeInTheDocument();
  });

  it("saves the edited return series", async () => {
    const user = userEvent.setup();
    render(<SequenceRiskPanel planId="plan-1" currency="INR" />);
    await screen.findByRole("img");

    await user.click(screen.getByRole("button", { name: "Save & compute" }));

    await waitFor(() => expect(mocks.putSequenceRisk).toHaveBeenCalled());
    expect(mocks.putSequenceRisk).toHaveBeenCalledWith("plan-1", [
      { yearIndex: 0, annualReturn: 0.3 },
      { yearIndex: 1, annualReturn: -0.1 },
    ]);
    expect(screen.getByText("Saved.")).toBeInTheDocument();
  });
});
