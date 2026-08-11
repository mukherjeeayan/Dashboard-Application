// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Welcome } from "./Welcome";

describe("Welcome", () => {
  it("shows the setup steps and lists available jurisdiction packs", () => {
    render(
      <Welcome
        packs={[
          { packId: "IN-2025", displayName: "India", currency: "INR", locale: "en-IN" },
          { packId: "US-2025", displayName: "United States", currency: "USD", locale: "en-US" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Welcome to WealthPath" })).toBeInTheDocument();
    expect(screen.getByText("India (IN-2025) — INR")).toBeInTheDocument();
    expect(screen.getByText("United States (US-2025) — USD")).toBeInTheDocument();
  });

  it("handles the no-packs case", () => {
    render(<Welcome packs={[]} />);
    expect(screen.getByText("No jurisdiction packs installed.")).toBeInTheDocument();
  });
});
