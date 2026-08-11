// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioAnalysisPanel } from "./ScenarioAnalysisPanel";

const mocks = vi.hoisted(() => ({
  getScenarioAnalysis: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getScenarioAnalysis: mocks.getScenarioAnalysis,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getScenarioAnalysis.mockResolvedValue({
    planId: "plan-1",
    scenarios: [
      { label: "best", liquidReturn: 0.15, lockedReturn: 0.077, endingCorpus: 2000000, deltaVsBase: 400000 },
      { label: "base", liquidReturn: 0.12, lockedReturn: 0.07, endingCorpus: 1600000, deltaVsBase: 0 },
      { label: "worst", liquidReturn: 0.09, lockedReturn: 0.063, endingCorpus: 1200000, deltaVsBase: -400000 },
    ],
    spread: 800000,
  });
});

describe("ScenarioAnalysisPanel", () => {
  it("renders the three scenarios and the spread", async () => {
    render(<ScenarioAnalysisPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByText("Scenario Analysis")).toBeInTheDocument();
    expect(mocks.getScenarioAnalysis).toHaveBeenCalledWith("plan-1");
    expect(screen.getByText("Best")).toBeInTheDocument();
    expect(screen.getByText("Base")).toBeInTheDocument();
    expect(screen.getByText("Worst")).toBeInTheDocument();
    expect(screen.getByText(/Best–worst spread:/)).toBeInTheDocument();
  });
});
