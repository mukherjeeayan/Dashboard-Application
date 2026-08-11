// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectionPanel } from "./ProjectionPanel";

const mocks = vi.hoisted(() => ({
  getProjection: vi.fn(),
}));

vi.mock("./api", () => ({
  api: { getProjection: mocks.getProjection },
}));

const PROJECTION = {
  planId: "plan-1",
  years: 3,
  rows: [
    { year: 1, expense: 500000, liquidBalance: 1740000, lockedBalance: 1070000, totalCorpus: 2810000, weights: { EQUITY: 0.7, GOLD: 0.1, DEBT: 0.2, CASH: 0 } },
    { year: 2, expense: 537500, liquidBalance: 1500000, lockedBalance: 1144900, totalCorpus: 2644900, weights: { EQUITY: 0.68, GOLD: 0.1, DEBT: 0.22, CASH: 0 } },
    { year: 3, expense: 577812, liquidBalance: 1200000, lockedBalance: 1225043, totalCorpus: 2425043, weights: { EQUITY: 0.66, GOLD: 0.1, DEBT: 0.24, CASH: 0 } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProjection.mockResolvedValue(PROJECTION);
});

describe("ProjectionPanel", () => {
  it("loads and renders the projection table and area chart", async () => {
    render(<ProjectionPanel planId="plan-1" currency="INR" />);

    expect(await screen.findByRole("img", { name: /locked vs liquid sleeve/ })).toBeInTheDocument();
    expect(screen.getByText("Projection")).toBeInTheDocument();
    expect(mocks.getProjection).toHaveBeenCalledWith("plan-1");

    // A row from the projection renders in the table (liquid 1,740,000 → "17,40,000").
    expect(screen.getByText(/17,40,000/)).toBeInTheDocument();
  });

  it("renders every year row", async () => {
    render(<ProjectionPanel planId="plan-1" currency="INR" />);
    await screen.findByRole("img");
    expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "3" })).toBeInTheDocument();
  });
});
