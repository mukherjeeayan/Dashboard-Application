# 12. Testing Strategy

## 12.1 Test pyramid

```
        E2E (Playwright)          — a handful of full journeys, incl. install/launch
     Integration (API, Vitest)    — every route, DB round-trip
  Golden-value (engine, Vitest)   — reproduce source doc worked examples
Unit (engine + jurisdictions, Vitest) — every pure function in isolation
```

## 12.1a Lot-based accounting tests (new — see `04-domain-model.md` §4.8)

Since lot-based holdings (direct securities, crypto) have no worked example
in the source workbook to validate against, these tests are specified from
first principles rather than golden-matched:

- FIFO/LIFO disposal correctness across multiple lots of the same ticker,
  including a disposal that exactly exhausts a lot and one that partially
  consumes it.
- Cost-basis adjustment correctness for a stock split (quantity multiplier
  applied, cost-per-unit recalculated, total cost basis unchanged).
- Long-term vs. short-term threshold correctness at the exact boundary day.
- A flat-rate, no-holding-period jurisdiction rule (crypto-style) applied
  correctly regardless of how long the lot was held.
- Yield income taxed independently of a later disposal of the same
  position (the two must not double- or zero-count the same value).

## 12.2 Unit tests

Every pure function in `packages/engine` and `packages/jurisdictions` gets
direct unit tests, including deliberately adversarial inputs: zero balances,
negative contributions rejected, `r == g` limiting-form branch in the
growing-annuity formula, empty withdrawal-waterfall order arrays, a
Jurisdiction Pack missing an optional field.

## 12.3 Jurisdiction Pack validation tests

- Schema validation tests (valid packs pass, deliberately malformed packs
  fail with a descriptive error) — one test file per pack plus a shared
  "fuzz the schema" property test using `zod`'s own parsing against
  randomly-mutated valid packs.
- Cross-pack consistency tests (§05 §5.6 step 4): every
  `withdrawalWaterfall.order` entry resolves to a defined `instrumentRules`
  block; every percentage field is within `[0,1]` (or documented bounds).
- The India-pack "transcription completeness" checklist test (§11 Phase 1)
  — the single most important test in this whole suite for the stated
  goal, since it directly guards against silently losing a statutory
  number during the Excel-to-JSON transcription.

## 12.4 Golden-value tests — the correctness bar

This is the project's primary correctness mechanism, since the source
workbook's own worked examples are the closest thing to a "known correct
answer" available.

**Deterministic engine (Phase 2 modules):** every fixture needed to write
these tests — exact inputs and exact expected outputs, not just a section
citation — is reproduced in full in
`15-reference-data-and-worked-examples.md` §15.3. No access to
`Investment_Workbook.docx` or `Investment.xlsm` is required to write or
run these tests. For each fixture in that appendix (PPF compounding,
EPF/PF's composed-contribution-with-cap behavior, the Single-Blended Monte
Carlo run, the goal target-date derivation, and any further fixtures added
there over time), write a Vitest test that:

1. Constructs the exact inputs given in `15-` §15.3.
2. Loads the `IN-2025` Jurisdiction Pack (`packages/jurisdictions/packs/IN-2025.json`,
   also shipped as part of this planning package — see `05-` §5.2).
3. Calls the corresponding `engine` function.
4. Asserts the result matches the expected figure given in `15-` §15.3
   within a documented tolerance (exact match for pure arithmetic like
   PPF/EPF; `1e-6` relative tolerance for anything involving the
   growing-annuity closed form, to allow for floating-point summation
   order differences).

Each such test carries a comment citing the exact appendix section (e.g.
`// fixture: 15-reference-data-and-worked-examples.md §15.3.1`), so a
reviewer can trace every test back to its origin without needing the
original spreadsheet. If a developer *does* have access to the original
`Investment_Workbook.docx`/`Investment.xlsm`, the appendix's own `_source`
citations (cell references, section numbers) allow independently
re-verifying any fixture against the original — but that access is a
nice-to-have for auditing, not a requirement for building or testing.

**Monte Carlo engines (Phase 3 modules):** exact reproduction of a
stochastic result isn't meaningful across a different language/RNG
implementation in the general case, but the frozen-seed path (§06 §6.6,
using the ported Acklam algorithm) is specifically designed to be
bit-comparable. Where the ported RNG stream can be seeded identically to a
value documented in the source, assert a tight match; otherwise (e.g. the
un-seeded default path), assert the **statistical shape** lands within a
tolerance band around the real, verified worked-example output in
`15-reference-data-and-worked-examples.md` §15.3.3 (a genuine 10,000-trial
run of the Single-Blended engine: 98.61% probability of success, with its
full P10/P50/P90/min/max outputs and every input the run used) — e.g.
"probability of success within ±2 percentage points over 5 repeated runs
at the documented trial count," which is statistically meaningful without
requiring bit-identical output.

## 12.5 Performance tests

- `engineMacroCombined` at 10,000 trials, asserted under the target in §07
  §7.6, run in CI on a defined reference machine spec (documented in the
  test file so a CI runner change doesn't silently invalidate the target).
- API response time budget for closed-form dashboard reads (target: under
  200ms for a plan with a realistic number of accounts/years of history).
- Client bundle size budget, checked in CI (Vite's build output size
  report), to keep the "one npm command" install lightweight.

## 12.6 Integration tests

- Every Fastify route: happy path, validation-failure path, not-found
  path.
- Full DB round-trip tests using a temporary SQLite file per test run (not
  mocked) — the schema and Drizzle queries are exactly what needs
  confidence, so testing against a real (temp) SQLite file is preferred
  over mocking the DB layer.

## 12.7 E2E tests (Playwright)

1. **Install & launch smoke test:** spawn the actual `cli` process (via
   `npm link` in a clean temp environment) and assert a real browser
   window opens to the expected local URL within a time budget. This is
   the literal, automated proof of the "npm command installs dependencies
   and opens the app in the local default browser" requirement.
2. **Full first-run journey:** jurisdiction selection → profile →
   assumptions → add one account of each `InstrumentType` → verify every
   dashboard renders without error → run one Monte Carlo engine to
   completion → verify results display.
3. **Second-jurisdiction smoke test:** repeat a reduced version of (2)
   using the US pack once authored (Phase 6), verifying UI labels and
   computed numbers change appropriately and no India-specific label
   leaks through.
4. **Accessibility assertions:** `axe-playwright` (or equivalent) run
   against every top-level screen, asserting no WCAG 2.1 AA violations.

## 12.8 Regression protocol for Jurisdiction Pack updates

When a country's statutory numbers change year over year (e.g. `IN-2025` →
`IN-2026`), the new pack version must pass:

1. Schema + cross-pack consistency validation (§12.3).
2. A refreshed or explicitly-updated golden-value fixture set for that
   pack, with a changelog entry explaining exactly which statutory numbers
   changed and citing a source.
3. The full E2E journey (§12.7.2) re-run against the new pack version
   before it becomes the new default for newly-created plans (existing
   plans keep referencing their originally-selected pack version, per §05
   §5.6 point 6).

## 12.9 AI Insights testing approach (optional feature)

See `16-ai-insights-byok.md` §16.10 for the full approach; summarized
here for the test pyramid's completeness:

- **No test in the default CI suite ever calls a real provider.** All
  provider adapters are tested against a mocked HTTP layer, matching this
  project's existing "no network dependency for the core test suite"
  posture (§12.1).
- Unit tests assert the exact, minimal JSON payload sent per insight type
  matches `16-` §16.6's stated scope.
- Integration tests cover the encrypt/decrypt round-trip for stored keys,
  the **Remove Key** action fully clearing stored credentials, and the
  Export Plan flow never including `ai_settings`.
- E2E (Playwright): a mocked-provider run of configure a fake key →
  generate one insight of each type → verify the AI-generated label
  renders — no real network call.
