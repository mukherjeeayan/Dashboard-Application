// First-run journey + Monte Carlo E2E (docs/09 §9.3, §9.4). Drives the real
// browser against the built client served by the API server on a fresh temp DB:
// create a plan, add an account, run a Monte Carlo simulation, and confirm the
// projection/risk panels render.

import { test, expect } from "@playwright/test";

test("first-run journey: create a plan, add an account, run Monte Carlo", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Known-benign during first run: the fan chart uses height="auto", a
    // fresh plan has no assumptions yet (logged, handled), and a favicon 404.
    if (
      /svg.? attribute height/.test(text) ||
      /Assumptions not found/.test(text) ||
      /Failed to load resource/.test(text)
    ) {
      return;
    }
    pageErrors.push(`console: ${text}`);
  });

  // Landing: welcome + plan creation form.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "WealthPath", exact: true })).toBeVisible();
  await expect(page.getByText("No plans yet.")).toBeVisible();

  // Fill the "New plan" form.
  await page.getByPlaceholder("Owner name").fill("Aya");
  await page.getByLabel("Date of birth").fill("1986-05-10");
  await page.getByLabel("Target retirement").fill("2060-01-01");
  await page.getByRole("combobox").selectOption("IN-2025");

  await page.getByRole("button", { name: "Create plan" }).click();

  // The plan appears in the sidebar and becomes selected.
  await expect(page.getByRole("button", { name: /Aya/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Add an account so the overview has data.
  await page.getByRole("tab", { name: "Accounts & Holdings" }).click();
  await page.getByPlaceholder("Label (e.g. Retirement fund)").fill("Mutual fund");
  await page.getByPlaceholder("Balance").fill("2000000");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Mutual fund", { exact: true })).toBeVisible();

  // The overview stats reflect the new account.
  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page.getByText(/Net worth/)).toBeVisible();

  // The projection panel should render (with a very small/short-horizon plan it
  // may be empty but the section is present).
  await page.getByRole("tab", { name: "Projection" }).click();
  await expect(page.getByRole("heading", { name: "Projection" })).toBeVisible();

  // Run a Monte Carlo simulation and wait for results.
  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByRole("button", { name: /Run Monte Carlo/ }).click();
  await expect(page.getByRole("button", { name: /Running…/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monte Carlo projection" })).toBeVisible({ timeout: 90_000 });

  // Success probability stat appears after completion.
  await expect(page.getByText("Success probability")).toBeVisible();
  await expect(page.getByText(/Median corpus/)).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join("\n")}`).toEqual([]);
});
