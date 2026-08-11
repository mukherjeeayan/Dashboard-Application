// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionItemsPanel } from "./ActionItemsPanel";

const mocks = vi.hoisted(() => ({
  getActionItems: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getActionItems: mocks.getActionItems,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActionItems.mockResolvedValue({
    planId: "plan-1",
    deadlines: [{ kind: "LOCKED_EXTENSION", label: "PPF", date: "2027-01-01" }],
    health: [{ account: "Mutual fund", stale: true, ageDays: 400 }],
    actionItems: [{ id: "a1", message: "Reconcile Mutual fund", severity: "WARN", source: "data-health" }],
  });
});

describe("ActionItemsPanel", () => {
  it("renders deadlines and the checklist", async () => {
    render(<ActionItemsPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByText("Action Items")).toBeInTheDocument();
    expect(mocks.getActionItems).toHaveBeenCalledWith("plan-1");
    expect(screen.getByText(/Upcoming deadlines/)).toBeInTheDocument();
    expect(screen.getByText(/Checklist/)).toBeInTheDocument();
    expect(screen.getByText(/Reconcile Mutual fund/)).toBeInTheDocument();
  });

  it("shows empty states when there is nothing to do", async () => {
    mocks.getActionItems.mockResolvedValue({
      planId: "plan-1",
      deadlines: [],
      health: [],
      actionItems: [],
    });
    render(<ActionItemsPanel planId="plan-1" currency="INR" />);

    await screen.findByText("Action Items");
    expect(screen.getByText("All clear.")).toBeInTheDocument();
    expect(screen.getByText(/No deadlines yet/)).toBeInTheDocument();
  });
});
