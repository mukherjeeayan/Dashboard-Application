---
name: formula-porting
description: Use this skill whenever implementing a calculation family described in docs/06- or docs/07- as a TypeScript function in packages/engine. Ensures every port is traceable to docs/15-'s fixtures, jurisdiction-generalized, and golden-value tested before being considered done.
---

# Formula Porting

## When to use this skill

Any time you are about to write or modify a function in `packages/engine`
whose behavior is specified in `docs/06-financial-calculation-engine.md`
or `docs/07-monte-carlo-engine.md`.

## Procedure

1. **Locate the exact specification.** Find the relevant subsection in
   `docs/06-` or `docs/07-`, and its matching worked-example fixture (exact
   inputs and outputs, not just a description) in
   `docs/15-reference-data-and-worked-examples.md` §15.1 or §15.3. Do not
   port from memory or from a paraphrase — re-read the actual fixture each
   time, since these formulas have specific edge-case branches (e.g. the
   `r≈g` limiting form in the growing-annuity formula, or the composed
   employer/employee/voluntary-with-cap contribution model in `15-`
   §15.3.2) that are easy to miss if working from summary alone. (If you
   happen to have access to the original `Investment_Workbook.docx` /
   `Investment.xlsm` / `MacroMonteCarlo.bas`, their section/cell
   references are cited throughout `15-` and can be used to independently
   re-verify a fixture — but this access is optional, not required.)

2. **Identify every hardcoded number in the specification** and classify
   each one:
   - A **statutory/tax number** (a rate, cap, or rule that's a fact about
     a specific country's law or a specific product's terms) → this
     becomes a field read from `JurisdictionPack`, per
     `docs/05-jurisdiction-tax-framework.md`. Never leave it as a literal
     in the ported code.
   - A **modeling assumption** (market CAGR, volatility, glide-path shape,
     scenario definitions) → this becomes a field read from
     `PlanAssumptions`, per `docs/04-domain-model.md` §4.5.
   - A **universal mathematical constant or structural constant** (e.g.
     `41` years in the projection horizon — itself actually a modeling
     choice, see the horizon-split note in source §3.3.6) → confirm which
     bucket it really belongs in before assuming it's safe to hardcode;
     when in doubt, treat it as a `PlanAssumptions` field rather than a
     literal.

3. **Write the TypeScript function as a pure function** taking
   `(inputs, assumptions, pack: JurisdictionPack)` — no I/O, no framework
   imports, no hidden state. See `docs/03-architecture.md` §3.3 for the
   expected module layout.

4. **Preserve every conditional branch from the source**, including edge
   cases the source doc calls out explicitly (e.g. the "Actual overrides
   Projected" reconciliation `IF(...<>0, Actual, Projected)` pattern in
   §3.1; the one-way "Locked Sleeve Unlocked?" flag in §3.3.4; the
   `ABS(r−g) < 0.0000001` special case in §3.4). Do not simplify these
   away even if they look like they'd rarely trigger — they exist in the
   source for a reason and a golden-value test may depend on them.

5. **Write the golden-value test alongside the implementation, not
   after.** Construct the exact inputs from the `docs/15-` fixture, load
   the relevant Jurisdiction Pack, call your function, and assert against
   the fixture's stated output (exact match for pure arithmetic;
   documented tolerance — see `docs/12-testing-strategy.md` §12.4 — for
   anything involving floating-point accumulation across many terms). Tag
   the test with a comment citing the `docs/15-` section.

6. **Run the banned-import lint check.** Confirm your new function does
   not import anything from `packages/jurisdictions/packs/*` directly.

## Common mistakes this skill exists to prevent

- Hardcoding a rate or cap "just for now, to get it working" and
  forgetting to move it into a Jurisdiction Pack before considering the
  work done.
- Silently dropping an edge-case branch because a first pass at the
  worked example happened to not exercise it.
- Writing the implementation and test in a way that both encode the same
  mistaken assumption, producing a passing-but-wrong test — always derive
  the test's expected value from `docs/15-`'s fixture, never from running
  your own implementation and copying its output.
