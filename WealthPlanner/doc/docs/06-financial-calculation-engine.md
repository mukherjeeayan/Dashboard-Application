# 06. Financial Calculation Engine Specification

Every calculation family in `Investment_Workbook.docx` §3, rewritten as
jurisdiction-agnostic pseudocode. Section numbers below map 1:1 to the
source document's §3.x sections so a reviewer can cross-check line by line.

## 6.1 Instrument-level compounding (source §3.1)

Universal recursive pattern, implemented once in `instruments/compounding.ts`
and specialized per `InstrumentType`:

```
balance(t) = (reconciled(t-1) ?? projected(t-1) + oneTimeAdjustments(t-1)) * (1 + roi(t)) + contribution(t)
```

- `oneTimeAdjustments(t-1)` — **added, see `14-india-tool-gap-analysis.md`
  G1**: the signed sum of that account's `OneTimeAdjustment` entries
  (§04 §4.3/§4.3.2) dated in period `t-1`, folded in before growth is
  applied — matching the source doc's own formula for MF specifically
  (`+ OneTimeAddition(t-1)`, §3.1.4) and confirmed against the real
  workbook's paired FD→MF transfer entries. Unlike `contribution(t)`, this
  term is not derived from a `ContributionRule` — it's a discrete,
  user-entered event, and it's the one place a negative value is expected
  and valid (a partial withdrawal or an outbound leg of a transfer).
- `reconciled(t-1)`: the user's manually-entered actual statement balance
  for the prior period, if entered (the source doc's "Actual overrides
  Projected" reconciliation pattern, §3.1). Stored per-account as
  `actualBalanceHistory` (§4.3 of `04-domain-model.md`).
- `roi(t)`: resolved per `ROIRule`:
  - `FLAT`: a single assumed rate from `PlanAssumptions`.
  - `STOCHASTIC`: `max(crashFloor, drawNormal(mean, stdev))`, using either
    live RNG or the frozen-seed LCG replay path (§6.6).
  - `WEIGHTED_BLEND` (multi-sleeve, NPS-equivalent): `Σ sleeveWeight_i × sleeveReturn_i`.
  - `PER_POSITION` (term deposits): each position compounds independently
    at its own entered rate until maturity, then rolls into the
    jurisdiction's reinvestment-rate assumption.
  - `DISCRETE_LOTS` (direct securities, crypto — see `04-domain-model.md`
    §4.2.1/§4.3.1): **not** part of the recursive compounding formula above
    at all. Current value is `Σ lot.remainingQuantity × latestManuallyEntered
    Price`; forward projection applies `FLAT`/`STOCHASTIC` ROI to that
    current total, same as `MARKET_LINKED_POOLED`. Realized-gain tax
    computation is handled separately in `tax/lotDisposal.ts`, dispatched
    per lot at disposal time using the account's `lotSelectionMethod` —
    this is the one instrument category where "compounding" and "taxable
    event" are computed by genuinely different code paths rather than one
    recursive formula, because a real market price (not a formula) drives
    valuation.
- `contribution(t)`: resolved per `ContributionRule`:
  - `STATUTORY_SALARY_LINKED`: reads employee/employer rates and any
    diversion cap from the active `JurisdictionPack.instrumentRules` block
    (replaces the source doc's hardcoded 12%/₹1,250 EPF formula, §3.1.2).
  - `FIXED_PERIODIC`: a flat recurring amount the user enters (SIP
    equivalent).
  - `CAPPED_STATUTORY`: like fixed periodic but clamped to the
    jurisdiction's `contributionCap` (replaces the hardcoded ₹1,50,000 PPF
    cap, §3.1.1).
  - `NONE`: e.g. a term deposit or a closed account.

## 6.2 Total Wealth & Net Worth (source §3.2)

```
totalWealth = Σ account.currentBalance (converted to plan base currency)
netWorth = totalWealth − Σ liability.outstandingBalance
```

`Current Year` is derived from `Plan.jurisdictionPack.fiscalYear`, not
hardcoded to an April–March convention:

```
currentFiscalYear = fiscalYear.convention === "CALENDAR"
  ? year(today)
  : year(today) + (month(today) >= fiscalYear.startMonth ? 0 : -1)
```

## 6.3 Future Projection — the core retirement engine (source §3.3)

- **Two-sleeve structure** (§3.3.1): sleeve membership is derived from each
  account's `liquidity` field (`04-` §4.2.0a: `LOCKED_STATUTORY` vs.
  everything else), not a hardcoded PPF+PF / MF+FD+NPS+Superannuation+Bank
  list. Any jurisdiction pack that introduces a new locked instrument type
  — or any account a user marks illiquid, like real estate — automatically
  routes correctly without an engine change.
- **Market return** (§3.3.2): a **two-level** toggle, clarified per
  `14-india-tool-gap-analysis.md` C1 — first, flat vs. stochastic
  (`PlanAssumptions.stochasticMode`); when stochastic, a second selection
  (`PlanAssumptions.stochasticMethodology: "SINGLE_BLENDED" |
  "CORRELATED"`) picks which of the two Monte Carlo methodologies (§07
  §7.2) supplies the live per-year draw feeding this projection, so the
  headline Projection stays in sync with whichever dedicated Monte Carlo
  engine the user trusts more, rather than running a third, disconnected
  return model. `MarketCrashFloor` applies as a hard floor regardless of
  which methodology is selected.
- **Glide path & mean-reverting inflation** (§3.3.3): formula structure
  unchanged from source; parameters (`GlideStartEquity`, `GlideStep`,
  `GlideFloor`, inflation long-run mean/reversion speed/shock vol/hike
  threshold) all live in `PlanAssumptions`, since these are modelling
  choices, not statutory facts. The glide path is precomputed as a
  year-by-year weight **table** (Equity/Gold/Debt/Cash per year through the
  full horizon), not purely parametric — both this projection and the
  Macro Monte Carlo engine (§07) look up their year's weights from the
  same table, confirmed against the real workbook's own `Retirement Glide
  Path` step.
- **Base expense: lifestyle multiplier before inflation** (added — see
  `14-india-tool-gap-analysis.md` G5): the base retirement expense is
  first scaled by `PlanAssumptions.lifestyleMultiplier` (default 1.0),
  then inflated forward per §3.3.4/§4.10's usual mechanics. This is a
  distinct lever from inflation — it lets a user stress-test "what if I
  simply choose to spend 50% more in retirement," independent of how
  prices move, mirroring the source workbook's own Lifestyle Upgrade
  Multiplier.
- **Withdrawal waterfall** (§3.3.4): see `05-jurisdiction-tax-framework.md`
  §5.4 — fully data-driven from `JurisdictionPack.withdrawalWaterfall`.
- **Primary vs. longevity-stress horizon** (§3.3.6): unchanged — a
  configurable split of the projection horizon (default 60→90 primary,
  91→100 stress), stored in `PlanAssumptions`.

## 6.4 Closed-form shortcuts (source §3.4)

Growing-annuity formula, unchanged (pure math, no jurisdiction dependency):

```
FV(sleeve, r, n) = sleeve*(1+r)^n − splitWeight*expense*[(1+r)^n − (1+g)^n] / (r − g)
```

with the `|r−g| < 1e-7 → n*(1+r)^(n-1)` limiting-form special case
preserved exactly as in the source (§3.4). Used identically by both the
**Sensitivity Matrix** (7×7 grid over Market CAGR × Inflation) and
**Scenario Analysis** (Worst/Base/Best named triples, sourced from
`PlanAssumptions`, not hardcoded).

## 6.5 Risk tools (source §3.5–§3.7)

- **Sequence-of-returns risk** (§3.5): identical mechanics — run the same N
  annual returns forward and reversed, report the ending-corpus gap. The
  historical-return-paste input becomes a manual-entry table in the UI
  (`Sequence Risk` screen), one row per year, exactly replacing the
  spreadsheet's "paste into column B" workflow — still fully manual entry,
  no import.
- **Guardrail withdrawal** (§3.6): unchanged Guyton–Klinger-style rule;
  guardrail width and adjustment step live in `PlanAssumptions`.
- **Asset allocation & concentration risk** (§3.7): the four risk buckets
  (Equity/Gold/Debt/Cash) and the Markowitz variance-covariance expansion
  are unchanged; the bucket-mapping percentages per account (e.g. "75% of
  this NPS-equivalent account counts as equity") are entered by the user
  per account rather than hardcoded, since sleeve splits vary by product
  and jurisdiction. `risk/allocationRisk.ts` additionally computes an
  explicit **rebalancing suggestion** (clarified per
  `14-india-tool-gap-analysis.md` C2) — not just a drift percentage: for
  each bucket, `rebalanceAmount = targetValue − currentValue` (positive =
  buy, negative = sell), against a user-editable target allocation stored
  in `PlanAssumptions`, confirmed against the real workbook's own `Target
  Allocation & Rebalancing` step.

## 6.6 Reproducible randomness (source §3.1.4, §4.6)

Ported directly rather than redesigned, because the source module already
solved this well:

- `mulberry32`-family seedable PRNG replaces the workbook's Lehman/
  Park–Miller LCG (`L(t) = MOD(16807 × L(t-1), 2147483647)`), chosen for
  being a well-understood, fast, good-enough-for-this-purpose generator
  available as a ~10-line pure function with no dependency.
- **Acklam's rational-polynomial inverse-normal-CDF approximation** is
  ported line-for-line from `MacroMonteCarlo.bas`'s `NormSInv` function —
  this is the one piece of the source model copied as closely to verbatim
  logic as possible, specifically because the source doc documents it as
  accurate to ~1e-9 relative error and the whole point of Monte Carlo
  cross-validation (§12.4) is bit-for-bit-comparable statistical behavior.
  The exact VBA source to port is reproduced in full in
  `15-reference-data-and-worked-examples.md` §15.1 — no access to the
  original `.bas` file is needed.
- "Freeze Random Seed" mode (§3.1.4) is preserved as a `PlanAssumptions`
  toggle + seed number, giving the same reproducible-run capability the
  workbook had.

## 6.7 Numeric precision strategy

The source workbook uses IEEE-754 doubles throughout (Excel's native
numeric type) across up to 41-year, 10,000-trial compounding chains.
WealthPath uses **native JS `number` (IEEE-754 double)** for the same
reason — for the following documented, deliberate reasons:

- Matching the source model's own numeric behavior is a testing
  *requirement* (golden-value tests must reproduce the workbook's own
  worked examples in `12-testing-strategy.md` §12.4) — introducing a
  different-precision decimal library would make certain reproducing
  differences than fixing them.
- All currency amounts are stored in the database as `NUMERIC` (SQLite) /
  validated by Zod as JS numbers, with a documented convention: **store and
  compute in the currency's minor unit is NOT used** (unlike a payments
  system) — amounts are stored as whole currency units with up to 2 decimal
  places, since this is a planning tool, not a transaction ledger, and
  matches the workbook's own convention.
- Any future move to arbitrary-precision decimals (e.g. `decimal.js`) is
  flagged as a Phase 6+ candidate only if golden-value testing surfaces
  compounding drift that matters at the precision users care about (whole
  currency units) — not pursued speculatively.

## 6.8 Goals, Insurance, Liabilities, Emergency Fund, Automation (source §3.11, §3.13–§3.16)

All five carry over with **no structural change**, only removing India-
specific defaults (recommended cover multipliers, LTCG-linked figures)
into `PlanAssumptions` / `JurisdictionPack` as appropriate:

- Goal funding PMT solve (§3.11): unchanged formula; `costInflation`,
  `expectedROI` per goal remain user-entered, as in the source.
  Additionally (found via workbook audit, `14-india-tool-gap-analysis.md`
  G7): a goal's target year may be entered directly, or derived from a
  named beneficiary's current age and a target age — `08-` §8.2's `goals`
  table supports both. The goals module also computes a **suggested
  monthly contribution per goal-linked holding** when a goal is earmarked
  across more than one funding account: the required annual investment is
  split across each holding by its earmark-allocation weight, divided by
  12, and rounded up to a practical contribution increment (e.g. nearest
  ₹100/$10) with a configurable floor minimum — mirroring the real
  workbook's `Goal Tracking` sheet, which does exactly this
  (`CEILING(...,100)` with a floored minimum) rather than leaving the user
  to do that arithmetic by hand.
- Loan amortization (§3.15): unchanged standard reducing-balance formula;
  fully currency/jurisdiction agnostic already.
- Emergency fund real-purchasing-power tracking (§3.13): unchanged.
- Insurance adequacy (§3.14): recommended-cover formula structure
  unchanged; the specific "income replacement years" and "base cover per
  person" multipliers move from hardcoded India defaults into
  jurisdiction-pack-suggested defaults (editable), since insurance norms
  vary by country. **Current cover in force is computed as the sum of the
  user's actual `InsurancePolicy` records** (§04), not a single formula —
  the real workbook's own "current cover" cell was found, on audit, to
  duplicate its *recommended*-cover formula rather than sum actual
  policies (almost certainly a copy-paste artifact, not an intentional
  design). WealthPath's list-of-policies model avoids this failure mode
  structurally, since there's no single formula to mis-copy — flagged per
  the QA agent's standing instruction to surface source-model
  inconsistencies rather than replicate them.
- Deadlines/Data Health/Action Items automation (§3.16): unchanged —
  entirely jurisdiction-independent date/threshold logic, generalized only
  by using the plan's fiscal-year convention (§6.2) instead of a hardcoded
  April–March one. Concrete deadline types, confirmed against the real
  workbook's `Deadlines & Reminders` sheet and generalized beyond
  India-specific instrument names: any `LOCKED_STATUTORY` account's
  extension/renewal window (PPF-equivalent), any account with a statutory
  mandatory-exit age (NPS-equivalent), every liability's payoff date,
  every term-deposit position's maturity date, and every insurance
  policy's renewal date. `deadlines.ts` **auto-generates one deadline
  entry per record** dynamically — a deliberate improvement over the real
  workbook, whose deadline rows are a manually-extended, hardcoded
  reference list per the sheet's own admitted limitation ("extend if you
  add more loans"). `actionItems.ts`'s aggregation surfaces the
  probability-of-success from **every Monte Carlo engine the user has
  run**, not a single headline figure — confirmed against the real
  workbook, whose Action Items sheet lists the Single-Blended and
  Correlated engines' results as independent rows.

## 6.9 Lot disposal & realized gains (new — see `04-domain-model.md` §4.8)

`tax/lotDisposal.ts` computes a single disposal's realized gain and tax:

```
function disposeLot(disposal: { quantity, pricePerUnit, date }, lot: Lot, instrumentType, pack): DisposalResult {
  const costBasisPerUnit = adjustedCostBasis(lot); // applies any splits/forks in costBasisAdjustments
  const gain = (disposal.pricePerUnit - costBasisPerUnit) * disposal.quantity;
  const holdingDays = daysBetween(lot.acquisitionDate, disposal.date);
  const rule = pack.capitalGains[instrumentType];
  const tax = computeGainsTax(gain, holdingDays, rule); // dispatches on rule.kind — LT/ST split, flat, or same-as-income
  return { gain, tax, netProceeds: gain - tax };
}
```

When a disposal spans multiple lots (selling more units than the oldest —
or, under `LIFO`, newest — single lot holds), the engine walks lots in the
order given by `lotSelectionMethod`, partially or fully consuming each in
turn, and sums the resulting `DisposalResult`s. This directly extends the
withdrawal-waterfall pattern (§05 §5.4) at the level of a single account's
internal lots, rather than across account types.

## 6.10 Tax module (source §3.12) — see also `05-jurisdiction-tax-framework.md`

The Tax tab's "redeem everything in one shot" post-tax retention ratio and
the SWP-vs-lump-sum §3.12.1 comparison are preserved structurally; every
rate and exemption is read from the active `JurisdictionPack.capitalGains`
/ `incomeTax` blocks rather than hardcoded 12.5%/₹1,25,000 figures.
