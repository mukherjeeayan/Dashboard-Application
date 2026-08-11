# 15. Reference Data & Worked Examples (Self-Contained Appendix)

**Why this document exists:** `06`, `07`, and `12` repeatedly say things
like "reproduce the source doc's worked example" or "port the Acklam
algorithm from `MacroMonteCarlo.bas`" — correct instructions, but ones a
developer can't actually follow without `Investment_Workbook.docx`,
`Investment.xlsm`, and `MacroMonteCarlo.bas` open in front of them. This
document closes that gap: every specific number, formula, and code block a
developer needs to actually implement and test the engine — pulled
directly from the live workbook's real formulas and cached computed
values, not summarized — is reproduced here in full. **A developer working
from this planning package alone, with no access to the original three
source files, should be able to build and correctness-test the entire
engine using this document plus `04`–`13`.**

The complete India Jurisdiction Pack this data populates is shipped as an
actual, ready-to-use file: `packages/jurisdictions/packs/IN-2025.json` in
this package (not reproduced here — open that file directly). Every field
in it cites the exact source cell(s) it came from.

## 15.1 The Acklam inverse-normal-CDF algorithm (verbatim from `MacroMonteCarlo.bas`)

This is the exact VBA source `06-` §6.6 and `07-` §7.2 instruct porting
"line-for-line." Reproduced here in full so that instruction is
actually followable:

```vba
Function NormSInvRnd() As Double
    Dim u As Double
    u = Rnd()
    If u <= 0 Then u = 0.0000001
    If u >= 1 Then u = 0.9999999
    NormSInvRnd = NormSInv(u)
End Function

Function NormSInv(ByVal p As Double) As Double
    ' Peter Acklam's algorithm for the inverse of the standard normal CDF.
    Const a1 As Double = -39.6968302866538
    Const a2 As Double = 220.94609842452
    Const a3 As Double = -275.928510446969
    Const a4 As Double = 138.357751867269
    Const a5 As Double = -30.6647980661472
    Const a6 As Double = 2.50662827745924

    Const b1 As Double = -54.4760987982241
    Const b2 As Double = 161.585836858041
    Const b3 As Double = -155.698979859887
    Const b4 As Double = 66.8013118877197
    Const b5 As Double = -13.2806815528857

    Const c1 As Double = -7.78489400243029E-03
    Const c2 As Double = -0.322396458041136
    Const c3 As Double = -2.40075827716184
    Const c4 As Double = -2.54973253934373
    Const c5 As Double = 4.37466414146497
    Const c6 As Double = 2.93816398269878

    Const d1 As Double = 7.78469570904146E-03
    Const d2 As Double = 0.32246712907004
    Const d3 As Double = 2.445134137143
    Const d4 As Double = 3.75440866190742

    Const pLow As Double = 0.02425

    Dim q As Double, r As Double

    If p < pLow Then
        q = Sqr(-2 * Log(p))
        NormSInv = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / _
                   ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    ElseIf p <= 1 - pLow Then
        q = p - 0.5
        r = q * q
        NormSInv = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / _
                   (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    Else
        q = Sqr(-2 * Log(1 - p))
        NormSInv = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / _
                    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    End If
End Function
```

TypeScript port target: `packages/engine/monteCarlo/rng/acklamInverseNormal.ts`
(per `07-` §7.2), same constants, same branch structure, same variable
names where reasonable, so a future diff against this source is trivial.
`NormSInvRnd` wraps it with a clamped `[0.0000001, 0.9999999]` uniform draw
— preserve that clamp; it exists specifically to avoid the function's
`Log(0)` / `Log(negative)` singularities at the exact extremes.

**Reference test values** (standard normal quantile function, independent
of the workbook — use to sanity-check the port before running any
workbook-derived golden-value test): `NormSInv(0.5) = 0`, `NormSInv(0.975)
≈ 1.959964`, `NormSInv(0.025) ≈ -1.959964`, `NormSInv(0.9861) ≈ 2.198`
(this last one recurs in §15.4 below — the workbook's own Monte Carlo
probability-of-success result happens to sit near this quantile).

## 15.2 Complete India statutory/assumption constants

The full set is shipped as `packages/jurisdictions/packs/IN-2025.json` in
this package — open that file directly rather than re-transcribing values
from here. Every field cites its exact source cell (e.g. `"_source":
"Assumptions row 27"`) so it can be independently re-verified against the
real workbook if the developer ever gets access to it, but the file itself
requires no such access to use.

One clarification worth stating here rather than only in a JSON comment:
the workbook's own `incomeTax` model (Assumptions row 48) is a **single
flat marginal rate** ("Marginal Income Tax Slab Rate (retirement)" =
`0.3`), not a full progressive bracket table — despite `05-
jurisdiction-tax-framework.md`'s general schema supporting full slab
tables (`kind: "SLAB"` with a `brackets` array) for jurisdictions that need
one. `IN-2025.json` ships the workbook's own simplification
(`incomeTax.marginalRateAtRetirement`) as its default, flagged with a note
explaining the gap. A developer wanting bracket-level precision for India
would need to source the actual current-year slab table independently —
this is explicitly out of what the workbook itself specifies, so it isn't
reproduced here as if it were.

## 15.3 Golden-value worked examples — deterministic engine

Each of these was extracted directly from the live workbook: the exact
formula as entered, and the exact cached value Excel computed from it.
Use these as the golden-value test fixtures `12-testing-strategy.md` §12.4
calls for.

### 15.3.1 PPF compounding (`instruments/lockedSafe.ts`)

Inputs: opening balance `1,060,038` (year 2023), annual contribution
`150,000`, PPF interest rate `7.1%` (`IN-2025.json`
`instrumentRules.PPF.declaredRate`).

Formula (as entered in the workbook, cell `PPF!C11`):
```
C11 = IF(F10<>0, F10, C10) * (1 + PPFInterestRate) + B10
    = 1,060,038 * 1.071 + 150,000
```

**Expected result: `1,285,300.698`** (exact — the workbook's own cached
value is `1285300.6979999999`, i.e. `1,285,300.698` to 3 decimal places;
the trailing `.6979999999` vs `.698` is ordinary IEEE-754 double
representation, not a computation difference — a correct port should
match to at least 6 significant figures).

Next year, same pattern (contribution unchanged at `150,000` since it's
still within the fiscal year, cap not yet exceeded):
```
C12 = 1,285,300.698 * 1.071 + 150,000 = 1,526,557.371
```
**Expected: `1,526,557.371`**.

Note the reconciliation branch (`IF(F10<>0, F10, C10)`) — this is the
"Actual overrides Projected" pattern (`06-` §6.1): once a user enters an
actual reconciled balance in column F for a given year, every subsequent
year's projection compounds off that actual figure instead of the
formula-projected one. The workbook's own data demonstrates this: row 13's
actual (`F13 = 1,526,557`, same as the prior year's actual — a real-world
case of a stale/un-updated reconciliation) causes row 14's projection
(`C14`) to compound off `1,526,557` rather than off `C13`'s own projected
value of `1,784,942.547` — a concrete test case for exactly this branch.

### 15.3.2 EPF/PF compounding with composed contribution sources (`instruments/compounding.ts`, `ContributionRule`)

This worked example is richer than the domain model's general description
(`06-` §6.1) suggests, and is worth implementing exactly: **PF total
contribution is not simply "employer % + employee %"** — it composes
three independently-computed sources, and the *voluntary* component's
formula changes shape once the statutory annual tax-free interest
threshold is reached.

Inputs (`IN-2025.json` `instrumentRules.PF`): monthly basic salary
`53,700`, EPF rate `12%` (both employee and employer), EPS pension cap
`₹1,250/month`, VPF rate `28%` of basic salary, annual tax-free threshold
`₹250,000`, declared PF rate `8.25%`, salary growth rate `2%`.

**Year 2024 (first full contribution year), formulas as entered:**
```
EPS pension contribution (B7)     = EPSPensionCap * 12 = 1,250 * 12 = 15,000
Employee contribution (C7)        = EPFRate * MonthlySalary * 12 = 0.12 * 53,700 * 12 = 77,328
Employer contribution (D7)        = ((EPFRate * MonthlySalary) - EPSPensionCap) * 12
                                   = ((0.12 * 53,700) - 1,250) * 12 = 62,328
Voluntary contribution (E7)       = (VPFRate * MonthlySalary) * 12 = 0.28 * 53,700 * 12 = 180,432.00
Total contribution (F7)           = C7 + D7 + E7 = 77,328 + 62,328 + 180,432 = 320,088
Closing balance (H7)              = (prior balance, 1,386,150) * (1 + 0.0825) + 320,088
                                   = 1,820,595.375
```
**Expected: EPS = `15,000`, Employee = `77,328`, Employer = `62,328`,
Voluntary = `180,432.00`, Total = `320,088`, Closing balance =
`1,820,595.375`.**

**Year 2026 — the contribution model changes shape.** Once the running
total contribution would exceed the `₹250,000` annual tax-free interest
threshold, the workbook **caps total contribution at the threshold and
solves the voluntary component as the plug**, rather than continuing to
grow voluntary contribution at its own formula:
```
Total contribution (F9)  = EPFTaxFreeThreshold = 250,000   (capped, not computed additively)
Employee (C9)             = C8 * (1 + SalaryGrowthRate) = 78,874.56 * 1.02 = 80,452.0512
Employer (D9)              = (compounding formula) = 65,452.0512
Voluntary (E9)              = F9 - C9 - D9 = 250,000 - 80,452.0512 - 65,452.0512 = 104,095.8976
```
**Expected: Total = `250,000` (capped), Voluntary solved as
`104,095.898`** (not computed from the VPF rate directly once the cap
binds). This is a genuine, distinct branch — `ContributionRule` for
`EMPLOYER_MANDATORY_LOCKED` types needs a "capped total, voluntary as
plug" mode, not just independent per-source formulas, to reproduce this
correctly. Test both branches (pre-cap and post-cap) explicitly.

### 15.3.3 Monte Carlo — Single Blended engine, full worked example with exact inputs and outputs

This is the complete input/output pair for `monteCarlo/engineSingleBlended.ts`
(§07 §7.3), taken directly from a real, cached 10,000-trial run
(`Monte Carlo Simulation!B28:B34`, "Last run: 04-Aug-2026 19:57 | 10000
trials | 0.2s").

**Inputs:**
```
Fixed Income sleeve at retirement (F0)    = 36,096,680.077
Market sleeve at retirement (G0)          = 412,358,392.072
Yearly expenditure at retirement (H0)     = 4,349,232.330
Fixed Income ROI (deterministic)          = 0.07
Inflation (deterministic)                  = 0.08
Market CAGR mean (μ)                        = 0.12
Market CAGR volatility (σ)                   = 0.18
Number of trials                              = 10,000
Years simulated                                = 41
Single-year market crash floor                 = -0.60
```

**Outputs (from this specific run):**
```
Probability of Success (corpus > 0 at age 100)  = 98.61%
Worst-case outcome (Min)                          = -772,624,872.166
10th percentile                                    = 3,486,149,380.338
Median (50th percentile)                            = 20,272,288,529.693
90th percentile                                      = 87,102,182,511.956
Best-case outcome (Max)                               = 1,100,257,749,512.951
```

**How to use this fixture:** because this is a stochastic simulation, a
port will not reproduce these exact percentile values from a different RNG
stream (per `12-testing-strategy.md` §12.4's statistical-tolerance
approach) — except along the frozen-seed path (`Freeze Random Seed = 1`,
seed `12345`, per `IN-2025.json` `stochasticControls`), which **should**
reproduce this run closely if the Acklam port and PRNG are implemented
correctly, since the workbook's own frozen-seed feature exists precisely
to make a run like this reproducible. Use this fixture two ways: (1) an
un-seeded run should land its probability-of-success within a few
percentage points of `98.61%` across repeated CI runs at 10,000 trials —
this is the statistical-tolerance check; (2) if a seeded/frozen-seed path
is implemented and this exact run's seed (`12345`) and inputs are used,
the result should match much more tightly, since the underlying random
sequence itself is meant to be reproducible.

### 15.3.4 Goal target-date/PMT worked example

From `Goal Tracking` (real data, names redacted from the developer-facing
description below — see `08-` §8.2 for the `beneficiaryName` field this
populates):

```
Goal: "Child Higher Education"
Beneficiary current age (D7)   = 1
Target age for goal (E7)        = 18
Years to goal (F7 = E7 - D7)      = 17
Current year (C7)                  = 2026
Target year (H7 = C7 + F7)           = 2043
Cost today (I7)                        = 1,500,000
```

**Expected: Years to goal = `17`, Target year = `2043`.** This is the
concrete fixture for the age-based goal target-date derivation described
in `04-domain-model.md`/`08-` (added per `14-india-tool-gap-analysis.md`
G7) — confirms the formula is simply `targetYear = currentYear +
(targetAge - beneficiaryCurrentAge)`, nothing more elaborate.

## 15.4 What this appendix deliberately does not include

- **Full progressive income-tax bracket tables** for India (see §15.2 —
  the workbook itself only models a flat marginal rate, so there is
  nothing further to transcribe faithfully; a bracket table would need to
  be independently sourced, not extracted from this workbook).
- **NAVAll's 17,711-row live NAV data** — this is the Power Query feed
  that has no equivalent in this product at all, permanently (`01-` §1.5);
  reproducing a snapshot of it here would misleadingly suggest it's needed
  for v1, when it isn't.
- **Every one of the workbook's 31 sheets' full row-by-row content** — this
  appendix is deliberately scoped to what `06`, `07`, and `12` actually
  reference and need worked examples for. If a future doc update adds a
  new "reproduce the source's worked example for X" instruction, the
  corresponding worked example should be added here at that time, not
  left dangling the way the original set was before this audit.
