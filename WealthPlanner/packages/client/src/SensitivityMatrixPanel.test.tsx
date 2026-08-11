// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SensitivityMatrixPanel } from "./SensitivityMatrixPanel";

const mocks = vi.hoisted(() => ({
  getSensitivityMatrix: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getSensitivityMatrix: mocks.getSensitivityMatrix,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSensitivityMatrix.mockResolvedValue({
    planId: "plan-1",
    x: { label: "Liquid return", values: [0.08, 0.12, 0.16] },
    y: { label: "Locked return", values: [0.05, 0.07, 0.09] },
    rows: [[1000000, 1500000, 2000000], [1100000, 1600000, 2100000], [1200000, 1700000, 2200000]],
    base: 1600000,
  });
});

describe("SensitivityMatrixPanel", () => {
  it("renders the base case and a full heatmap grid", async () => {
    render(<SensitivityMatrixPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByText("Sensitivity Matrix")).toBeInTheDocument();
    expect(mocks.getSensitivityMatrix).toHaveBeenCalledWith("plan-1");
    expect(screen.getByText(/Base case:/)).toBeInTheDocument();
    // x-axis headers for liquid returns.
    expect(screen.getByText("8%")).toBeInTheDocument();
    expect(screen.getByText("16%")).toBeInTheDocument();
    // y-axis header for a locked return.
    expect(screen.getByText("9%")).toBeInTheDocument();
  });
});
