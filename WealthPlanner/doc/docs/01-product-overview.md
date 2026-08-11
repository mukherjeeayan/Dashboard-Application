# 01. Product Overview

## 1.1 What WealthPath is

WealthPath is a single-user, local-first personal retirement and wealth
planning application. It is the generalized, software-native successor to
`Investment.xlsm` — a comprehensive but India-specific and Excel/VBA-bound
model. WealthPath keeps every piece of financial reasoning the workbook
contains (instrument-level compounding, a two-sleeve tax-aware drawdown
engine, sensitivity/scenario grids, sequence-of-returns risk, guardrail
withdrawal strategy, three Monte Carlo engines, goal tracking, insurance
adequacy, loan amortization, and an automated action-items checklist), adds
one optional feature the workbook never had — **AI Insights**, a **BYOK**
(Bring Your Own Key) feature that lets the user attach their own LLM
provider API key to generate plain-language commentary on their own
already-computed numbers (`16-ai-insights-byok.md`) — and rebuilds the
whole thing so that:

- **Anyone in any country** can use it, not just an Indian salaried investor.
- **No spreadsheet is involved at any point** — installation, data entry, and
  every calculation happen inside a purpose-built app.
- The tax and instrument rules for a given country are **data, not code** —
  swappable "Jurisdiction Packs" instead of hardcoded cell formulas.
- It installs and runs **entirely on the user's own machine** via a single
  `npm` command, with no server-side data storage, no account creation, and
  no internet dependency after installation, with exactly one explicit,
  opt-in exception: the **AI Insights** feature (`16-ai-insights-byok.md`),
  which is off by default and only ever calls out to a provider using the
  user's own API key. The workbook's Power Query NAV live-data-lookup
  feature has no equivalent in this product at all — see §1.5.

## 1.2 Who it is for

The same persona the workbook was built for, generalized: a financially
literate, hands-on individual who tracks multiple account types (a mix of
market-linked and safe/government-backed instruments), is comfortable
entering their own assumptions, and wants more than a single output number —
they want the *range* of outcomes and the *sensitivity* of the plan to the
assumptions behind it.

## 1.3 Core questions the app answers

Same as the workbook, restated without India-specific instrument names:

1. What is my current total wealth and net worth, across every account I
   hold, in my base currency?
2. If I keep contributing and the market behaves roughly as expected, will
   my retirement corpus outlast me?
3. How sensitive is that answer to market returns and inflation?
4. What happens under a deliberately pessimistic scenario?
5. Does the *order* in which good and bad market years arrive put my plan at
   risk, even if the long-run average return is unchanged?
6. What is the actual *probability* my money lasts, not just a single
   deterministic answer?
7. Am I on track for named life goals (education, a house down payment, a
   wedding, etc.) with their own dates and costs?
8. Do I have enough insurance, and how are my loans amortizing?
9. What, concretely, should I do next? (a single, auto-aggregated action
   list)

## 1.4 What generalization means, concretely

| Excel model (India-specific) | WealthPath (generalized) |
|---|---|
| Seven named instruments: MF, PPF, EPF/PF, NPS, Superannuation, FD, Bank | Seven **abstract instrument types** (§`04-domain-model.md`) that any country's real products map onto |
| Tax rules (LTCG 12.5% Sec 112A, EEE for PPF/EPF, slab rates) hardcoded into formulas | Tax rules supplied by a **Jurisdiction Pack** (§`05-jurisdiction-tax-framework.md`), loaded at runtime |
| ₹ (INR) hardcoded, Indian financial year (Apr–Mar) | Configurable currency + configurable fiscal-year convention (calendar or offset) |
| Single hardcoded set of statutory constants (₹1,50,000 PPF cap, ₹1,250 EPS cap, 12% EPF rate) | Statutory constants live inside each Jurisdiction Pack; the calculation engine reads them, never assumes them |
| VBA macros, manual Alt+F8 trigger, in-process to Excel | Background worker threads (Node `worker_threads` / browser Web Workers), triggered from the UI, same "manual, on-demand" philosophy |
| Excel cell color convention for input vs. output | Explicit UI form fields (input) vs. read-only computed panels (output); same mental model, enforced by the UI instead of a convention |
| Data entered by typing into cells or Power Query NAV refresh | Data entered through guided forms only; **no import of any kind** (explicit product decision — see §1.5) |

## 1.5 Explicit non-goals (permanent v1.0 scope boundaries)

This is the complete v1.0 scope. The items below are deliberate, permanent
scope boundaries — not gaps deferred to a later date:

- **No Excel/CSV import.** All entries are typed in manually through app
  forms, exactly as the user (Ayan) specified. This is a deliberate,
  permanent design constraint, not a temporary limitation to be lifted
  quietly later.
- **No multi-user accounts, no cloud sync, no server-side storage of
  financial data.** Single local user, local database, by design.
- **No live market data feeds** (the workbook's Power Query NAV lookup —
  used in three places: a reference sheet of all published fund NAVs,
  live-priced sub-holdings on goal-linked funds, and the emergency fund's
  designated liquid-fund balance — has no equivalent in this product at
  all, permanently). All three are replaced by manual price entry
  (`04-domain-model.md` §4.3.1/§4.3.1a).
- **No investment advice.** Like the workbook, WealthPath is a set of tools
  for the user to stress-test their own assumptions, and this disclaimer is
  shown in-app — including on every AI Insights panel, where it applies at
  least as strongly (`16-ai-insights-byok.md` §16.1).
- **No mobile app** — the browser-based local web app is responsive but
  the target is desktop/laptop browsers.

The one feature in this product that talks to an external service at all
is AI Insights (`16-ai-insights-byok.md`), and it is opt-in, off by
default, and uses the user's own API key rather than any service
WealthPath operates.

## 1.6 Success criteria for v1

- A user with **zero existing data** can, starting from `npx wealthpath`,
  install the app, create a profile, select a jurisdiction, manually enter
  every asset/liability/goal/insurance record the workbook supports, and see
  every dashboard the workbook has (Summary, Portfolio Risk, Projection,
  Sensitivity Matrix, Scenario Analysis, Sequence Risk, Withdrawal Strategy,
  the three Monte Carlo views, Goal Tracking, Tax, Emergency Fund, Insurance,
  Liabilities, Deadlines, Action Items) — computed correctly for their
  chosen jurisdiction.
- Every closed-form and simulated calculation in the app reproduces the
  workbook's own **worked examples** (documented throughout
  `Investment_Workbook.docx`) when run with India Jurisdiction Pack values
  and the same inputs — this is the primary correctness bar (see
  `12-testing-strategy.md`).
- A second Jurisdiction Pack (e.g. US) can be authored and dropped in
  **without touching the calculation engine's code**, proving the
  generalization actually holds.
