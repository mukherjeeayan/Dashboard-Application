# WealthPath — Personal Retirement & Wealth Planning App

> A from-scratch, npm-installable, local-first web application that generalizes
> `Investment.xlsm` (a single-user, India-specific Excel retirement model) into
> a jurisdiction-agnostic planning tool usable by anyone, anywhere, entering
> their own numbers by hand.

This repository (as planned) contains **no imported Excel data and no Excel
import feature**. Every figure the app calculates starts from data the user
types in once, through guided forms. The Excel workbook and its VBA Monte
Carlo module were used to produce this package, but **this package is now
self-contained**: every formula, algorithm, and worked example a developer
needs has been extracted and reproduced directly in `docs/06`, `docs/07`,
and — most importantly — `docs/15-reference-data-and-worked-examples.md`,
plus a complete, ready-to-use `packages/jurisdictions/packs/IN-2025.json`.
A developer with no access to `Investment_Workbook.docx`,
`Investment.xlsm`, or `MacroMonteCarlo.bas` should be able to build and
correctness-test the entire engine from this package alone. See
`docs/15-` for exactly what that appendix covers and why it exists.

## What's in this planning package

| Folder / File | Purpose |
|---|---|
| `docs/01-product-overview.md` | What the app does, who it's for, generalized from the Excel model's own stated purpose |
| `docs/02-tech-stack.md` | Full technology stack decision record, with rationale and alternatives considered |
| `docs/03-architecture.md` | System architecture: process model, module boundaries, data flow |
| `docs/04-domain-model.md` | The generalized (non-India-specific) financial domain model |
| `docs/05-jurisdiction-tax-framework.md` | The pluggable multi-jurisdiction tax & instrument-rules engine — the core generalization work |
| `docs/06-financial-calculation-engine.md` | Every calculation family from the Excel model, rewritten in jurisdiction-agnostic pseudocode |
| `docs/07-monte-carlo-engine.md` | The three Monte Carlo simulation engines (replacing the VBA module) as a TypeScript worker-based engine |
| `docs/08-data-model-and-storage.md` | Local database schema, manual-entry forms, validation rules |
| `docs/09-ui-ux-spec.md` | Screen-by-screen UI spec, mapped from the workbook's 31 tabs to app views |
| `docs/10-implementation-plan.md` | Phased roadmap from empty repo to v1.0 |
| `docs/11-task-list.md` | Granular, checkable task breakdown per phase |
| `docs/12-testing-strategy.md` | Unit/property/golden-value/E2E testing approach, incl. cross-checks against real, reproduced worked examples |
| `docs/13-packaging-distribution.md` | How `npm install` / `npx` ends up installing deps and opening the app in the default browser |
| `docs/14-india-tool-gap-analysis.md` | Audit trail: a direct, cell-by-cell review of the actual `Investment.xlsm` against `01`–`13`, with the resulting fixes applied in place — explains *why* those edits exist |
| `docs/15-reference-data-and-worked-examples.md` | **Self-containment appendix**: the full Acklam RNG algorithm, every golden-value test fixture (exact inputs and outputs), and pointers to the real, shipped India pack — everything needed to build and test the engine without the original source files |
| `docs/16-ai-insights-byok.md` | **Optional, off-by-default feature**: BYOK (Bring Your Own Key) AI Insights — lets the user attach their own LLM provider API key to generate plain-language commentary on their own already-computed numbers. Fully in-scope for v1.0, built in its own gated phase (`10-` Phase 7) |
| `packages/jurisdictions/packs/IN-2025.json` | The actual, complete India Jurisdiction Pack — every statutory number transcribed and cited, ready to drop into the real codebase, not an illustrative excerpt |
| `.claude/agents/*.md` | Claude Code sub-agent definitions for building this project (seven roles — see `.claude/agents/README.md`) |
| `.claude/skills/*.md` | Claude Code skill definitions to keep formula-porting, jurisdiction-authoring, and packaging consistent across sessions |

## Reading order

If you're picking this up cold: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09**,
then **10 → 11** to start building, and keep **12–13** open throughout, with
**15** open alongside **06/07/12** specifically — it's the fixture data
those three docs' instructions actually operate on. **14** is a standalone
audit trail — read it alongside `04`/`06`/`08` to see exactly what changed
and why once the actual spreadsheet (not just its written spec) was checked
line by line. **16** (AI Insights / BYOK) is a self-contained feature
layered on top of everything else — read it once you understand `03`
(architecture) and `08` (data model), since it extends both. "Self-contained"
describes its design, not its priority: it has its own gated build phase
(`10-` Phase 7, `11-` Phase 7) and the v1.0.0 release is not cut until that
phase's exit criteria are met, exactly like every other phase — it is not
optional polish to build only if time remains.

## Is this package self-contained?

**Yes, as of this revision.** Earlier drafts of this package described
*what* to build (architecture, schemas, formula structure) but pointed at
`Investment_Workbook.docx`/`Investment.xlsm`/`MacroMonteCarlo.bas` for the
actual numbers, algorithms, and test fixtures needed to build and verify
it — meaning a developer without those three files would hit real walls
(no way to write a golden-value test, no way to port the Monte Carlo RNG,
no complete statutory dataset for India). `docs/15-` and
`packages/jurisdictions/packs/IN-2025.json` close that gap directly: the
exact VBA source for the RNG, every worked-example fixture with real
numbers, and a complete, citation-backed India pack are now reproduced in
this package itself. If you do have access to the original three files,
their section/cell references are cited throughout for independent
re-verification — but that access is now a nice-to-have for auditing, not
a requirement for building.


## One-paragraph summary of the generalization

The Excel model hardcodes India: PPF, EPF, NPS, Superannuation, ₹1,50,000 PPF
caps, Section 112A LTCG at 12.5%, an April–March fiscal year. WealthPath
replaces every India-specific rule with a **generic instrument taxonomy**
(nine abstract instrument *types* — the original seven asset classes the
workbook covers, plus direct securities and digital assets/crypto, added to
support lot-based holdings the workbook never needed — not named products)
plus a **Jurisdiction Pack** — a versioned JSON/YAML document that supplies
the country-specific numbers (contribution caps, tax brackets, EEE/EET/TEE
treatment, fiscal-year convention, currency) that used to be hardcoded into
cell formulas. India becomes the first Jurisdiction Pack, not a special case
baked into the code. See `docs/05-jurisdiction-tax-framework.md`.
