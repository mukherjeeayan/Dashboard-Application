// AI Insights mocked-provider E2E (docs/16 §16.10). Drives the real browser
// against the built client served by the API server. The provider HTTP call is
// made by the Node server (not the browser), so the mock is a genuine local
// test double: a small HTTP server on 127.0.0.1 standing in for the provider's
// chat-completions endpoint. No real network call or API key is involved.
// Flow: create a plan → configure a fake key → generate one insight of each
// type → verify the panel renders the AI-generated text.
//
// Note: this file is prefixed "z-" so it runs after firstRun.spec.ts, which
// asserts the DB starts empty (Playwright runs spec files alphabetically and
// shares one server/DB across a run).

import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import AxeBuilder from "@axe-core/playwright";

const INSIGHT_BUTTONS = [
  "Plan summary",
  "Monte Carlo interpretation",
  "Sensitivity / scenario explanation",
  "Goal progress narrative",
  "Action items prioritization",
];

test("AI insights: configure a fake key and generate one insight of each type", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      /Failed to load resource/.test(text) ||
      /Assumptions not found/.test(text) ||
      /svg.? attribute height/.test(text)
    ) {
      return;
    }
    pageErrors.push(`console: ${text}`);
  });

  // Local test double: an HTTP server standing in for the provider endpoint.
  let callCount = 0;
  const mockServer: Server = createServer((req, res) => {
    callCount += 1;
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: `MOCK_INSIGHT_${callCount}` } }] }));
    });
  });
  await new Promise<void>((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(mockServer.address() as AddressInfo).port}`;

  try {
    // Create a plan.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "WealthPath", exact: true })).toBeVisible();
    await page.getByPlaceholder("Owner name").fill("Iris");
    await page.getByLabel("Date of birth").fill("1986-05-10");
    await page.getByLabel("Target retirement").fill("2060-01-01");
    await page.getByRole("combobox").selectOption("IN-2025");
    await page.getByRole("button", { name: "Create plan" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    // Configure the AI connection with a fake key against the local mock.
    await page.getByRole("tab", { name: "AI Insights" }).click();
    await expect(page.getByRole("heading", { name: "AI Insights" })).toBeVisible();
    await page.getByRole("checkbox", { name: "Enabled" }).check();
    await page.getByLabel("Provider").selectOption("CUSTOM");
    await page.getByLabel("Model").fill("mock-model");
    await page.getByLabel("Base URL").fill(baseUrl);
    await page.getByLabel("API key").fill("sk-fake-1234");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    // Generate one insight of each type.
    for (const label of INSIGHT_BUTTONS) {
      await page.getByRole("button", { name: label }).click();
    }

    // Each generated insight renders with the mocked provider's text.
    for (let i = 1; i <= INSIGHT_BUTTONS.length; i += 1) {
      await expect(page.getByText(`MOCK_INSIGHT_${i}`)).toBeVisible();
    }
    expect(callCount).toBe(INSIGHT_BUTTONS.length);

    // The AI Insights screen must also be WCAG 2.1 AA clean.
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations,
      `axe violations on AI Insights:\n${results.violations
        .map((v) => `- ${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
        .join("\n")}`,
    ).toEqual([]);

    expect(pageErrors, `page errors: ${pageErrors.join("\n")}`).toEqual([]);
  } finally {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  }
});
