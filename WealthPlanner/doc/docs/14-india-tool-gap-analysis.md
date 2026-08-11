# 14. Gap Analysis: Investment.xlsm vs. This Planning Package

**Purpose:** `01`–`13` were originally written from `Investment_Workbook.docx`
(a detailed written spec) and `MacroMonteCarlo.bas`. This document records a
direct audit of the **actual live workbook**, `Investment.xlsm` (31 sheets,
real data), against those planning docs, to catch anything the workbook
does that the written spec understated or omitted. Where a real gap was
found, it has been fixed directly in the relevant doc (`04`, `05`, `06`,
`08`, `09`, `11`) — this document is the audit trail explaining *why* those
edits were made, not a duplicate of the content itself. It covers two
audit passes: an initial pass (§14.1–§14.4, findings G1–G5/C1–C4) and a
follow-up pass that opened the remaining not-yet-individually-checked
sheets (§14.5, findings G6–G7/C5–C8).

**Method:** every one of the 31 sheets in `Investment.xlsm` was read in
full (via `markitdown` + targeted cell inspection) and cross-checked
against the corresponding section of `01`–`13`. Findings below are grouped
by severity.

## 14.1 Structural gaps (fixed in this revision)

### G1 — One-time / lump-sum instrument adjustments, distinct from periodic contribution

**Found:** `MF projection` and `Fixed Deposit` both carry a per-year
**"One time transaction"** / **"Additional one time increase"** column,
separate from the regular yearly contribution — e.g. a ₹75,00,000 one-off
addition to MF in 2025, paired with an exactly-offsetting −₹75,00,000 entry
on the FD sheet the same year (an inter-account transfer/rebalancing
event). The source doc's own §3.1.4 formula confirms this is load-bearing:
`Balance(t) = (Actual(t-1) + Contribution(t) + OneTimeAddition(t-1) −
MajorExpenseDeduction(t)) × (1 + ROI(t))`.

**Gap:** our `ContributionRule` model (`04-domain-model.md`) only supports
periodic/statutory/capped contribution patterns — there was no way to
record a discrete, one-off addition or withdrawal against an account for a
specific year.

**Fix applied:** `04-domain-model.md` §4.3 now includes a `oneTimeAdjustments`
array on `Account` (dated, signed amount, optional `linkedTransferRef` to
express a paired transfer between two accounts without double-entry).
`06-financial-calculation-engine.md` §6.1 updated to fold this into the
universal compounding formula. `08-data-model-and-storage.md` gets a new
`one_time_adjustments` table.

### G2 — Multi-holder (primary/joint) and nominee tracking

**Found:** `Bank Accounts` tracks **Primary Holder** and **Joint Holder**
per account across three real family members; `Fixed Deposit` adds a
**Nominee** and **Holding Pattern** (Single/Joint) field per position.

**Gap:** `Plan.ownerProfile` in our domain model assumes a single person;
there was no `Holder` concept at all, and no nominee field anywhere —
despite nominee tracking being exactly the kind of estate-adjacent detail
a real personal-finance tool needs.

**Fix applied:** `04-domain-model.md` §4.3 adds a `Holder` entity
(name, relationship-to-plan-owner) and `primaryHolderRef` /
`jointHolderRefs[]` / `nomineeRef` fields on `Account`. This is additive —
a single-holder plan simply has one `Holder` record and every account
points at it, so this doesn't complicate the common case.

### G3 — Real Estate & Physical Assets as a built-in, appreciating-but-illiquid category

**Found:** `Liabilities` sheet's second section tracks Real Estate &
Physical Assets (Asset Name, Current Value, **Expected Appreciation Rate
p.a.**, Type, Projected Value at Retirement) — explicitly **excluded from
the liquid drawdown corpus** but included in Net Worth.

**Gap:** our seven (now nine, after the stocks/crypto addition) instrument
types don't cleanly cover "compounds at a flat appreciation rate, no
contributions, always illiquid, current-value tracked" — the closest fit,
`MARKET_LINKED_POOLED`, bundles in NAV-based semantics that don't apply,
and critically, **liquidity was never a field decoupled from instrument
type** — it was implicitly baked into each type's identity.

**Fix applied:** `04-domain-model.md` §4.2 adds an explicit `liquidity:
"LIQUID" | "LOCKED_STATUTORY" | "ILLIQUID_DISCRETIONARY"` field on
`Account`, decoupled from `InstrumentType`, with a default per type that
any account can override (this generalizes the override mechanism already
introduced for custom vehicle types). Real estate is modeled as a
`MARKET_LINKED_POOLED` account with `contributionRule: NONE`,
`roiRule: FLAT`, and `liquidity: "ILLIQUID_DISCRETIONARY"` — no new
instrument type needed once liquidity is a real field.

### G4 — Rule-derived consistency checks

**Found:** `Summary` sheet's **"Rule-Derived Horizon Checks"** block
computes what a date *should* be from first principles (e.g. PPF final
maturity year from opening year + lock-in + extensions taken) and compares
it against what's actually being used elsewhere in the model, flagging
`OK`/`CHECK`. In the real file this genuinely caught a mismatch (PPF rule
says 2034, actual usage runs to 2049 — i.e., extensions were taken but
never recorded on the Assumptions tab).

**Gap:** our `automation/` module only had `deadlines.ts`, `dataHealth.ts`,
and `actionItems.ts` — none of which validate that a rule-derived value and
an actually-used value agree.

**Fix applied:** `06-financial-calculation-engine.md` §6.8 adds
`automation/ruleConsistency.ts` as a fourth automation module, and
`actionItems.ts`'s aggregation now explicitly includes its output. This is
a genuinely valuable, cheap check — it directly catches the kind of
silent-drift bug this whole architecture (single-source-of-truth
Assumptions/Jurisdiction Pack) is supposed to prevent, and the real
workbook proves it's not just theoretical.

### G5 — Lifestyle expense multiplier, distinct from inflation

**Found:** `Cash Flow Assumptions` Step 4, **"Lifestyle Upgrade
Multiplier"** — a flat scalar applied to the base retirement expense,
independent of and in addition to inflation compounding (e.g. 1.5× to
stress-test a materially more expensive retirement lifestyle).

**Gap:** our expense model (`06-` §6.3) only inflates a base expense
forward; there was no separate lever for "what if I simply choose to spend
more/less than today's baseline, independent of inflation."

**Fix applied:** `06-financial-calculation-engine.md` §6.3 adds this as an
explicit `lifestyleMultiplier` field in `PlanAssumptions`, applied once to
the base expense figure before inflation compounding begins.

### G6 — Withdrawal Waterfall enable/disable toggle

**Found:** `Assumptions` row 164, "Tax Waterfall Enabled (1 = sequential
Bank/FD → MF → PPF → NPS, 0 = legacy pooled draw)" — a boolean that falls
back to a simple pooled draw with no tax-efficient sequencing, kept as an
explicit comparison mode rather than the waterfall being unconditionally
on.

**Gap:** `05-jurisdiction-tax-framework.md` §5.4 specified the waterfall's
*order* as jurisdiction data, but had no notion of the waterfall being
optional at the plan level.

**Fix applied:** `04-domain-model.md` §4.5.1 adds
`PlanAssumptions.withdrawalWaterfallEnabled` (default `true`); `05-` §5.4
clarifies that this Plan Assumption gates whether `runWithdrawalWaterfall`
runs at all, distinct from the jurisdiction-supplied order it uses when
enabled.

### G7 — Goal target date derivable from a beneficiary's age

**Found:** `Goal Tracking` sheet columns B–H track a named `Beneficiary`,
that beneficiary's `Current Age`, and a `Target Age for Goal`, computing
`Years to Goal`/`Target Year` from those rather than requiring a flat
target date. The same sheet's column L also computes a **suggested
monthly contribution per goal-linked funding holding**, splitting the
required annual investment across multiple specific funds by weight and
rounding to a practical SIP increment (`CEILING(...,100)`) with a floored
minimum.

**Gap:** `Goal` entity (`08-` §8.2) only supported a flat `targetYear`,
with no beneficiary/age-based derivation, and the goals module had no
per-holding contribution-recommendation output.

**Fix applied:** `08-data-model-and-storage.md` §8.2's `goals` table adds
optional `beneficiaryName`/`beneficiaryCurrentAge`/`targetAge` fields
(exactly one of a flat `targetYear` or the age-based triple is expected to
be set). `06-financial-calculation-engine.md` §6.8 adds the goal-linked
suggested-monthly-contribution computation to the goals module's
responsibilities.

## 14.2 Clarifications (existing docs were technically correct but under-specified)

### C1 — Two distinct stochastic methodologies, selectable as the *live* Projection driver

The workbook's `Market Return Source` toggle (Assumptions §4) doesn't just
pick flat-vs-stochastic — when stochastic, it further selects **which**
stochastic methodology (single-blended-CAGR vs. correlated Equity/Gold)
feeds the main Projection tab's year-by-year draw, keeping the primary
projection in sync with whichever dedicated Monte Carlo tab the user
trusts more. `06-financial-calculation-engine.md` §6.3 has been clarified
to state this explicitly as a two-level toggle (mode, then methodology)
rather than implying a single flat/stochastic switch.

### C2 — Rebalancing amounts, not just drift metrics

`Asset Allocation Risk` Step 6 computes an explicit ₹ **Rebalance Action**
(buy/sell) per bucket to close the gap between target and current
allocation, not merely a drift percentage. `06-` §6.5 now names this
output explicitly as part of `risk/allocationRisk.ts`'s contract.

### C3 — Unit/NAV-based valuation as an alternate entry mode for pooled holdings

`Goal Tracking`'s fund-linked sub-holdings and the `Emergency Fund`'s
designated liquid fund both track **Units Held × price-per-unit** rather
than a single entered balance — the same quantity-times-price pattern
built for lot-based accounts (`04-` §4.2.1), but simpler (current
valuation only, no cost basis or disposal history, since these are
progress-tracking use cases, not tax-relevant holdings). `04-` §4.3.1 now
notes that any `POOLED_BALANCE` account may optionally be entered via
units × price instead of a single balance figure, reusing the same manual
price-entry UI already specified for lot-based accounts, purely as a data
-entry convenience — the underlying `Account.currentBalance` is still what
the engine consumes either way.

### C4 — Scope of the deliberately-excluded live NAV feature

The real workbook's Power Query NAV lookup is used in **three** places
(the `NAVAll` reference sheet, `Goal Tracking`'s fund holdings, and
`Emergency Fund`'s designated liquid fund), not only the single "MF price"
case implied by earlier drafts of this planning package. The decision to
exclude all live data feeds from v1 (`01-` §1.5) is unchanged — this
finding doesn't reopen that decision — but `01-` §1.5 now names all three
sites explicitly so a future contributor doesn't miss one and
half-implement live sync.

### C5 — Sequence Risk's return series is shared with Withdrawal Strategy

**Found:** `Withdrawal Strategy` row 14 states its return sequence source
is "Sequence Risk tab, column B" directly — one manually-entered 40-year
return series feeds both screens, not two independent entry points.

**Clarification applied:** `08-data-model-and-storage.md` §8.4's
`sequence_risk_returns` table comment now states explicitly that this one
table feeds both the Sequence Risk and Withdrawal Strategy screens.

### C6 — Insurance "current cover" must be summed from real policy records, not a single formula

**Found:** the real workbook's `Insurance!B12` ("Current Term Cover In
Force") formula (`=B7*B6`) duplicates the *recommended*-cover formula
immediately above it rather than summing actual policies — almost
certainly a copy-paste artifact, not an intentional design choice.

**Clarification applied:** `06-` §6.8 now names this finding explicitly as
a concrete, real example of the source-model inconsistencies the QA &
Correctness Auditor agent is instructed to flag rather than silently
replicate (`.claude/agents/qa-correctness-auditor.md`). WealthPath's
design — a proper list of `InsurancePolicy` records, summed — already
avoids this failure mode structurally, since coverage is computed from
data, not a single hand-maintained formula.

### C7 — Action Items must surface every Monte Carlo engine's result independently

**Found:** the real workbook's `Action Items` sheet lists the
Single-Blended Monte Carlo and Correlated Monte Carlo probability-of-
success figures as two independent rows (rows 20 and 29), not one merged
headline figure.

**Clarification applied:** `06-` §6.8 states explicitly that
`actionItems.ts` must surface probability-of-success from every Monte
Carlo engine the user has run, not a single figure.

### C8 — Major Expenses: the real `.xlsm` is narrower than this planning package's design, deliberately

**Found:** the real workbook's `Major Expenses` sheet only auto-deducts
*pre-retirement* one-off expenses, and only from the mutual-fund-
equivalent bucket specifically; post-retirement one-off expenses require
manual addition to the retirement expenditure figure (the sheet's own
`Phase`/`Status` columns say so directly).

**Not a gap — confirmed intentional:** this planning package's engine
design (`06-` §6.8, sourced from the more complete
`Investment_Workbook.docx` §4.10) already supports post-retirement
one-time expenses as a first-class, auto-applied withdrawal component,
going beyond what the actual `.xlsm` currently does. No doc change; noted
here so a future reviewer doesn't mistake this for an unresolved
inconsistency between the audit and the design.

## 14.3 Minor / cosmetic (not fixed — genuinely out of scope)

- **RNG diagnostic columns** (`LCG State`, `Uniform Draw` exposed per row
  under Freeze-Seed mode) — a nice-to-have transparency aid for
  power users auditing exactly how a frozen-seed reproduction works.
  Not required for correctness (the underlying reproducibility guarantee
  is already specified in `06-` §6.6); could be added as a debug/advanced
  view later without any engine change. No doc update made.
- **Excel-specific UI mechanics** (collapsible row groups for the age
  91–100 "longevity stress test" section, `[-]`/`[+]` outline buttons on
  Bank Accounts/MF/Fixed Deposit year tables) — these map to ordinary
  collapsible-section UI components, already implicitly covered by normal
  frontend engineering in `09-ui-ux-spec.md`. No doc update needed.
- **Hardcoded row-reference caveats** (e.g. "Liabilities row 5 — extend if
  you add more loans" on Deadlines & Reminders) — an Excel-formula
  limitation with no analogue in a real database-backed app (adding a loan
  is just another row; nothing needs manual range extension). Not a
  functionality gap, just evidence the database model is already strictly
  better here.

## 14.4 What was confirmed as already correctly covered

For completeness, the following areas were checked closely and found to
already match the real workbook's actual behavior with no changes needed:
the four-Monte-Carlo-engine structure (§07), the Debt/Hybrid/Equity-style
liquid/locked two-sleeve split and tax waterfall (§06 §6.3), the
retirement glide path mechanics including gold-held-constant and
debt/cash absorbing the released equity share (§06 §6.3 — table-driven,
not purely parametric, confirmed against `Asset Allocation Risk` Step 8),
the guardrail withdrawal rule and its worked outputs (§06 §6.5), the
cost-basis-ratio approach to MF tax on drawdown including the SWP-vs-
lump-sum comparison (§06 §6.10), the Sensitivity Matrix/Scenario Analysis/
Sequence Risk mechanics (§06 §6.4–6.5), NPS deferment to age 70 continuing
to contribute post-retirement (§04, confirmed against real `NPS` sheet
rows for ages 61–75), and per-fund-folio tracking within the MF instrument
type (confirmed this already maps cleanly onto "one `Account` per fund" in
our domain model, §04 §4.2 — no change needed).

## 14.5 Second pass — remaining sheets audited (Assumptions §14–19, Tax Assumptions, Goal Tracking, Insurance, Liabilities, Deadlines & Reminders, Action Items, Asset Allocation Risk, Summary)

A second, more exhaustive pass opened every remaining sheet not yet
individually checked in §14.1–§14.4 above — the full `Assumptions` tab
(all 19 numbered sections), `Tax Assumptions`, `Cash Flow Assumptions`,
`Goal Tracking`, `Insurance`, `Liabilities` (including its Real Estate &
Physical Assets sub-section), `Deadlines & Reminders`, `Action Items`, and
`Asset Allocation Risk` (all 8 steps) — cell-by-cell, formulas visible.
Findings G6, G7, and C5–C8 above are the product of this second pass.
Everything else in those sheets was found to already match `01`–`13` at
the level of detail those docs specify, including: the mean-reverting
inflation and rate-hike acceleration model (§4.5.1's `Rate-Hike Extra
Reversion Speed` parameter), the 80/20-style primary-vs-longevity-stress
horizon split (Assumptions §19), and the four-bucket (Equity/Gold/Debt/
Cash) portfolio-variance risk model including its rebalancing-action
output (already covered by C2). The workbook's VBA project was also
re-checked in full at this pass (31 sheet-class modules — all Excel
boilerplate with no logic — plus `MacroMonteCarlo.bas`) and confirmed to
contain nothing beyond what `07-monte-carlo-engine.md` already specifies.
