// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanningPanel } from "./PlanningPanel";

const mocks = vi.hoisted(() => ({
  listGoals: vi.fn(),
  listLiabilities: vi.fn(),
  listInsurance: vi.fn(),
  listExpenses: vi.fn(),
  createGoal: vi.fn(),
  createLiability: vi.fn(),
  createInsurance: vi.fn(),
  createExpense: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    listGoals: mocks.listGoals,
    listLiabilities: mocks.listLiabilities,
    listInsurance: mocks.listInsurance,
    listExpenses: mocks.listExpenses,
    createGoal: mocks.createGoal,
    createLiability: mocks.createLiability,
    createInsurance: mocks.createInsurance,
    createExpense: mocks.createExpense,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listGoals.mockResolvedValue([]);
  mocks.listLiabilities.mockResolvedValue([]);
  mocks.listInsurance.mockResolvedValue([]);
  mocks.listExpenses.mockResolvedValue([]);
  mocks.createGoal.mockResolvedValue({ id: "g1" });
  mocks.createLiability.mockResolvedValue({ id: "l1" });
  mocks.createInsurance.mockResolvedValue({ id: "i1" });
  mocks.createExpense.mockResolvedValue({ id: "e1" });
});

describe("PlanningPanel", () => {
  it("lists each section and shows empty states", async () => {
    render(<PlanningPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("No goals yet.")).toBeInTheDocument();
    expect(screen.getByText("No liabilities yet.")).toBeInTheDocument();
    expect(screen.getByText("No insurance policies yet.")).toBeInTheDocument();
    expect(screen.getByText("No major expenses yet.")).toBeInTheDocument();
    expect(mocks.listGoals).toHaveBeenCalledWith("plan-1");
  });

  it("creates a goal from the form", async () => {
    const user = userEvent.setup();
    render(<PlanningPanel planId="plan-1" currency="INR" />);

    await user.type(await screen.findByLabelText("Goal label"), "Retire in Goa");
    fireEvent.change(screen.getByLabelText("Goal cost today"), { target: { value: "50000000" } });
    fireEvent.change(screen.getByLabelText("Target year"), { target: { value: "2045" } });
    await user.click(screen.getByRole("button", { name: "Add goal" }));

    await waitFor(() => expect(mocks.createGoal).toHaveBeenCalled());
    expect(mocks.createGoal).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({ label: "Retire in Goa", costToday: 50000000, targetYear: 2045 }),
    );
  });

  it("creates a liability from the form", async () => {
    const user = userEvent.setup();
    render(<PlanningPanel planId="plan-1" currency="INR" />);

    await user.type(await screen.findByLabelText("Liability label"), "Home loan");
    fireEvent.change(screen.getByLabelText("Liability principal"), { target: { value: "5000000" } });
    fireEvent.change(screen.getByLabelText("Liability rate %"), { target: { value: "8.5" } });
    fireEvent.change(screen.getByLabelText("Tenure (months)"), { target: { value: "240" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-01-01" } });
    await user.click(screen.getByRole("button", { name: "Add liability" }));

    await waitFor(() => expect(mocks.createLiability).toHaveBeenCalled());
    expect(mocks.createLiability).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({
        label: "Home loan",
        principal: 5000000,
        rate: 8.5,
        tenureMonths: 240,
        startDate: "2026-01-01",
      }),
    );
  });

  it("creates an insurance policy and a major expense", async () => {
    const user = userEvent.setup();
    render(<PlanningPanel planId="plan-1" currency="INR" />);

    await user.type(await screen.findByLabelText("Policy type"), "TERM");
    fireEvent.change(screen.getByLabelText("Cover in force"), { target: { value: "10000000" } });
    await user.click(screen.getByRole("button", { name: "Add policy" }));

    fireEvent.change(screen.getByLabelText("Expense year"), { target: { value: "2030" } });
    await user.type(screen.getByLabelText("Expense description"), "Child wedding");
    fireEvent.change(screen.getByLabelText("Expense amount today"), { target: { value: "20000000" } });
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    await waitFor(() => expect(mocks.createInsurance).toHaveBeenCalled());
    await waitFor(() => expect(mocks.createExpense).toHaveBeenCalled());
    expect(mocks.createInsurance).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({ type: "TERM", coverInForce: 10000000 }),
    );
    expect(mocks.createExpense).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({ year: 2030, description: "Child wedding", amountTodayValue: 20000000 }),
    );
  });
});
