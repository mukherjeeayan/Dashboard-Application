# 09. UI/UX Specification

## 9.1 Navigation structure

The source workbook's 31 tabs become a left-hand nav grouped into seven
sections, collapsing tabs that were pure sub-steps of one workflow into a
single screen with internal tab/step navigation (e.g. Asset Allocation
Risk's 8 "Steps" become one screen with 8 in-page sections, not 8 nav
items):

```
1. Overview
   - Summary (Total Wealth, Net Worth, Portfolio Risk Dashboard)
2. Setup
   - Profile & Jurisdiction
   - Assumptions  (the single source-of-truth screen, source doc's Assumptions tab)
3. Accounts
   - one screen per held account, grouped by InstrumentType
   - Balance Reconciliation (bulk "enter this period's actual balances" view)
   - Direct Holdings (Stocks & Crypto) — a distinct entry flow for
     `MARKET_LINKED_DIRECT`/`DIGITAL_ASSET` accounts: Buy (creates a lot),
     Sell (records a disposal against one or more lots per
     `lotSelectionMethod`), Update Price (bulk per-ticker price entry,
     replacing the concept of "reconciling a balance" with "reconciling a
     price"), and Record Yield Income (dividends/staking rewards)
4. Planning
   - Goals  (Goal Tracking + Goal Projections merged)
   - Major Expenses
   - Liabilities
   - Insurance
   - Emergency Fund
5. Projection & Risk
   - Projection  (Future Projection v2, year-by-year table + chart)
   - Sensitivity Matrix  (7×7 heat-map)
   - Scenario Analysis  (Worst/Base/Best cards)
   - Sequence Risk  (input table + dual-order chart)
   - Withdrawal Strategy  (Fixed-Real vs. Guardrail comparison)
   - Asset Allocation Risk  (volatility, HHI, target-vs-actual drift)
   - Monte Carlo  (tabbed: Single Blended / Correlated / Accumulation / Macro Combined)
   - Tax  (post-tax retention ratio, SWP vs. lump-sum)
6. Housekeeping
   - Deadlines & Reminders
   - Action Items  (default landing tab after Overview on repeat visits)
7. Settings
   - AI Insights  (provider, API key, enable/disable, Remove Key — see
     `16-ai-insights-byok.md` §16.7; this is app *configuration*, distinct
     from the plan-data-entry screens in "Setup")
```

Every screen in Overview, Planning (Goals only), and Projection & Risk that
has an AI Insights insight type defined (`16-ai-insights-byok.md` §16.5)
also gets one small "✨ Generate Insight" button — see §9.7.

## 9.2 Input vs. output — enforced by the UI, not a color convention

The source workbook relies on a blue/yellow-fill vs. green/black-text
convention that "nothing stops you from typing over... by mistake" (§2.2 of
source doc). WealthPath enforces this structurally:

- Every **Setup**, **Accounts**, and **Planning** screen is a form: labeled
  input fields, client + server Zod validation, explicit **Save** action.
- Every **Overview** and **Projection & Risk** screen is **read-only**:
  rendered from computed data, no editable fields anywhere on the page
  (aside from a "Re-run Monte Carlo" trigger button, which is an action,
  not a data field).
- This eliminates the entire class of bug the source workbook explicitly
  warns about (accidentally typing into a green-linked formula cell) by
  construction, rather than by convention.

## 9.3 First-run flow

1. `npx wealthpath` → browser opens to a **Welcome** screen (no plan
   exists yet).
2. **Select your jurisdiction** — a dropdown of available Jurisdiction
   Packs (India, US, UK, "Other / custom" pointing to authoring docs).
   This single choice drives every default, label, and rule for the rest
   of setup — the direct generalization of the source model's implicit
   "this is India" assumption.
3. **Profile & Assumptions** — DOB, target retirement age, base currency
   (defaulted from the jurisdiction, editable), and the full Assumptions
   form, pre-filled with the jurisdiction pack's suggested defaults where
   it has any (e.g. suggested market CAGR/volatility), otherwise sensible
   generic defaults.
4. **Add your first account** — guided, one instrument type at a time, with
   inline help text explaining each `InstrumentType` in plain language
   (directly reusing the spirit of source doc §1.4's "Plain-English
   Primer") localized per the selected jurisdiction's `displayLabel`s.
5. Once at least one account exists, **Overview** becomes the default
   landing screen and every Projection & Risk screen becomes accessible
   (screens requiring data they don't have yet show a clear empty-state
   with a link to the relevant input screen, rather than a blank or
   error page).

## 9.4 Dashboards — direct source-doc equivalents

| Source doc dashboard (§1.2 table) | WealthPath screen | Notes |
|---|---|---|
| Total Wealth & Net Worth | Overview → Summary panel | Unchanged shape |
| Portfolio Risk Dashboard | Overview → Risk panel | Unchanged shape |
| Future Projection v2 | Projection & Risk → Projection | Year-by-year table + area chart (locked vs liquid sleeve) |
| Ending Corpus Sensitivity Grid | Projection & Risk → Sensitivity Matrix | Rendered as an SVG heat-map (D3), not a spreadsheet grid |
| Best/Base/Worst Verdicts | Projection & Risk → Scenario Analysis | Three cards with a clear pass/fail verdict badge |
| Sequencing Gap | Projection & Risk → Sequence Risk | Dual-line chart, gap called out numerically |
| Probability of Success | Projection & Risk → Monte Carlo (4 tabs) | P10/P50/P90 fan chart per engine, per §07 |
| Goal Progress | Planning → Goals | Card per goal: on-track/shortfall badge + required annual investment |
| Action Items | Housekeeping → Action Items | Single aggregated checklist, exactly as source doc §3.16 |

## 9.5 Accessibility & localization

- All currency/number formatting uses `Intl.NumberFormat` driven by
  `JurisdictionPack.locale` (e.g. Indian digit grouping — lakh/crore — for
  the India pack, standard thousands grouping elsewhere) — this generalizes
  the source workbook's rupee-only number formatting.
- All screens meet WCAG 2.1 AA contrast and keyboard-navigation targets
  (checked in Playwright accessibility assertions, `12-testing-strategy.md`
  §12.6).
- Date inputs respect the jurisdiction's fiscal-year convention when
  relevant (e.g. a "current fiscal year" label reads "FY2025-26" for
  APR_MAR conventions, "2025" for calendar-year conventions).

## 9.6 Explicit non-features reflected in the UI

- No "Import" button or drag-and-drop file zone anywhere in the app.
- No "Connect brokerage account" / OAuth flows — every number is
  typed by the user, matching the required manual-entry-only scope.

## 9.7 AI Insights UI surface (optional, off by default)

- **Settings → AI Insights**: provider selector, masked API key entry with
  **Test Connection**, model selection where applicable, enable/disable
  toggle, **Remove Key**. See `16-ai-insights-byok.md` §16.7.
- Every screen listed in `16-ai-insights-byok.md` §16.5's table gets one
  small "✨ Generate Insight" button, always visible; if the feature is
  disabled/not configured, it shows a tooltip linking to Settings → AI
  Insights rather than being hidden, so the feature is discoverable
  without being pushed on the user.
- Generated insight panels use a visually distinct background/border
  treatment plus an "✨ AI-generated" label and timestamp, so there is
  never ambiguity between an engine-computed panel (§9.2) and
  LLM-generated commentary.
