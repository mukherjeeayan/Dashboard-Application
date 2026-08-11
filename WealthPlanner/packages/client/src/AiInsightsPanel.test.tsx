// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiInsightsPanel } from "./AiInsightsPanel";

const mocks = vi.hoisted(() => ({
  getAiSettings: vi.fn(),
  listInsights: vi.fn(),
  putAiSettings: vi.fn(),
  deleteAiSettings: vi.fn(),
  testAiConnection: vi.fn(),
  generateInsight: vi.fn(),
}));

vi.mock("./api", () => ({
  api: {
    getAiSettings: mocks.getAiSettings,
    listInsights: mocks.listInsights,
    putAiSettings: mocks.putAiSettings,
    deleteAiSettings: mocks.deleteAiSettings,
    testAiConnection: mocks.testAiConnection,
    generateInsight: mocks.generateInsight,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAiSettings.mockResolvedValue({
    enabled: true,
    provider: "OPENAI",
    model: "gpt-4o-mini",
    customBaseUrl: null,
    keyLastFour: "1234",
  });
  mocks.listInsights.mockResolvedValue([]);
  mocks.putAiSettings.mockResolvedValue({
    enabled: true,
    provider: "OPENAI",
    model: "gpt-4o-mini",
    customBaseUrl: null,
    keyLastFour: "5678",
  });
  mocks.deleteAiSettings.mockResolvedValue(undefined);
  mocks.testAiConnection.mockResolvedValue({ ok: true });
  mocks.generateInsight.mockResolvedValue({
    id: "i-1",
    planId: "plan-1",
    insightType: "PLAN_SUMMARY",
    generatedText: "Your plan looks well balanced.",
    provider: "OPENAI",
    model: "gpt-4o-mini",
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
});

describe("AiInsightsPanel", () => {
  it("loads settings and shows the stored key suffix", async () => {
    render(<AiInsightsPanel planId="plan-1" />);

    expect(await screen.findByText(/Configured: OPENAI/)).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("AI Insights")).toBeInTheDocument();
    expect(mocks.getAiSettings).toHaveBeenCalled();
    expect(mocks.listInsights).toHaveBeenCalledWith("plan-1");
  });

  it("saves updated settings", async () => {
    const user = userEvent.setup();
    render(<AiInsightsPanel planId="plan-1" />);
    await screen.findByText(/Configured: OPENAI/);

    await user.clear(screen.getByLabelText("API key"));
    await user.type(screen.getByLabelText("API key"), "sk-test-5678");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(mocks.putAiSettings).toHaveBeenCalled());
    expect(mocks.putAiSettings).toHaveBeenCalledWith({
      enabled: true,
      provider: "OPENAI",
      model: "gpt-4o-mini",
      customBaseUrl: undefined,
      apiKey: "sk-test-5678",
    });
    expect(screen.getByText("Settings saved.")).toBeInTheDocument();
  });

  it("generates an insight and appends it to the list", async () => {
    const user = userEvent.setup();
    render(<AiInsightsPanel planId="plan-1" />);
    await screen.findByText(/Configured: OPENAI/);

    await user.click(screen.getByRole("button", { name: "Plan summary" }));

    await waitFor(() => expect(mocks.generateInsight).toHaveBeenCalled());
    expect(mocks.generateInsight).toHaveBeenCalledWith("plan-1", { insightType: "PLAN_SUMMARY" });
    expect(await screen.findByText(/well balanced/)).toBeInTheDocument();
  });
});
