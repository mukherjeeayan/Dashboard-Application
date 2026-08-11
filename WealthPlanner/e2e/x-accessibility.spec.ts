// Automated WCAG 2.1 AA accessibility audit (docs/09 §9.5, docs/12 §12.4):
// after a real plan + account exist, run axe-core over the full PlanView (all
// panels render on one scrolling page) and assert no WCAG A/AA violations.
// Runs after firstRun.spec.ts alphabetically so the "No plans yet." empty-DB
// assertion in that spec is unaffected.

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("WCAG 2.1 AA: no axe violations across the plan screens", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Owner name").fill("A11y");
  await page.getByLabel("Date of birth").fill("1986-05-10");
  await page.getByLabel("Target retirement").fill("2060-01-01");
  await page.getByRole("combobox").selectOption("IN-2025");
  await page.getByRole("button", { name: "Create plan" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Add an account so the holdings/overview tables render real content.
  await page.getByPlaceholder("Label (e.g. Retirement fund)").fill("Mutual fund");
  await page.getByPlaceholder("Balance").fill("2000000");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Mutual fund", { exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(
    results.violations,
    `axe violations:\n${results.violations
      .map((v) => `- ${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
      .join("\n")}`,
  ).toEqual([]);
});
