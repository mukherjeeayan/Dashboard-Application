# 05. Jurisdiction & Tax Framework

This is the piece of the system that lets WealthPath be "maintained by
different tax jurisdictions," as requested. It is the direct replacement for
every hardcoded rupee amount, percentage, and rule described in
`Investment_Workbook.docx` §3.1–§3.4 and §3.12.

## 5.1 What a Jurisdiction Pack is

A **Jurisdiction Pack** is a versioned, self-contained JSON document (Zod
schema-validated, lives in `packages/jurisdictions/packs/*.json`) that
supplies every country-specific number and rule the engine needs. The
engine imports the *shape* of a Jurisdiction Pack (`JurisdictionPack` type)
but never imports a specific country's data — the active pack is selected
at runtime from the user's `Plan.jurisdictionPackId`.

```
packages/jurisdictions/
  schema.ts              # Zod schema — the CONTRACT every pack must satisfy
  loader.ts               # validates + loads a pack by id/version at server startup
  packs/
    IN-2025.json           # India, tax-year-versioned
    US-2025.json             # United States
    UK-2025.json               # United Kingdom
    GENERIC-TEMPLATE.json       # heavily-commented starter template for authoring a new pack
```

## 5.2 Anatomy of a Jurisdiction Pack

```jsonc
{
  "packId": "IN-2025",
  "displayName": "India",
  "currency": "INR",
  "fiscalYear": { "startMonth": 4, "convention": "APR_MAR" },  // vs. e.g. CALENDAR for most countries
  "locale": "en-IN",

  "instrumentRules": {
    // one block per InstrumentType this jurisdiction supports, keyed by a
    // jurisdiction-local ruleRef the user's Account.jurisdictionRuleRef points at
    "PPF": {
      "instrumentType": "GOV_SAFE_LOCKED",
      "displayLabel": "Public Provident Fund (PPF)",
      "declaredRate": 0.071,
      "contributionCap": { "amount": 150000, "period": "FISCAL_YEAR" },
      "lockIn": { "years": 15, "extension": { "blockYears": 5, "unlimited": true } },
      "taxTreatment": { "onContribution": "EXEMPT", "onGrowth": "EXEMPT", "onExit": "EXEMPT" } // EEE
    },
    "EPF": {
      "instrumentType": "EMPLOYER_MANDATORY_LOCKED",
      "displayLabel": "Employees' Provident Fund (EPF)",
      "employeeRate": 0.12,
      "employerRate": 0.12,
      "employerDiversion": { "capAmount": 1250, "period": "MONTH", "reason": "EPS pension scheme" },
      "declaredRate": 0.0825,
      "taxTreatment": {
        "onContribution": "EXEMPT", "onGrowth": "EXEMPT",
        "onExit": { "condition": "continuousServiceYears >= 5", "ifMet": "EXEMPT", "ifNotMet": "SLAB_RATE" }
      }
    },
    "NPS": {
      "instrumentType": "MARKET_LINKED_MULTI_SLEEVE",
      "displayLabel": "National Pension System (NPS)",
      "sleeves": ["EQUITY", "GOVT_DEBT", "CORP_DEBT"],
      "exitSplit": { "lumpSumPct": 0.60, "annuitizedPct": 0.40 },
      "annuityRateDefault": 0.06,
      "taxTreatment": {
        "lumpSum": "EXEMPT",
        "annuityIncome": "SLAB_RATE_ON_RECEIPT"
      },
      // Added per 14-india-tool-gap-analysis.md audit: during retirement
      // drawdown, only a CONFIGURABLE SHARE of each year's draw from this
      // sleeve is taxed at slab rate — not a one-time binary split applied
      // once at exit. The remaining share of every draw mirrors the
      // tax-free lump-sum treatment above. This is distinct from
      // `exitSplit` (which governs how much of the corpus becomes liquid
      // vs. annuitized at retirement) — `perDrawTaxableFraction` governs
      // the ongoing tax treatment of each year's withdrawal from whatever
      // remains in this sleeve post-retirement.
      "perDrawTaxableFraction": 0.4
    }
    // ... SUPERANNUATION, MF, FD, BANK blocks follow the same pattern
  },

  "incomeTax": {
    "kind": "SLAB",
    "brackets": [
      { "upTo": 300000, "rate": 0.0 },
      { "upTo": 700000, "rate": 0.05 },
      { "upTo": 1000000, "rate": 0.10 }
      // ... full slab table
    ]
  },

  "capitalGains": {
    "MARKET_LINKED_POOLED": {
      "longTerm": {
        "holdingPeriodDays": 365,
        "rate": 0.125,
        "annualExemption": 125000
      },
      "shortTerm": { "rate": "SLAB_RATE" }
    },
    "MARKET_LINKED_DIRECT": {
      // India taxes direct equity the same as pooled equity funds under Sec 112A —
      // this block can simply mirror MARKET_LINKED_POOLED's, or diverge where a
      // jurisdiction's rules for direct holdings differ (e.g. no annual exemption
      // for direct securities, or a different holding-period threshold)
      "longTerm": { "holdingPeriodDays": 365, "rate": 0.125, "annualExemption": 125000 },
      "shortTerm": { "rate": "SLAB_RATE" },
      "lotSelectionDefault": "FIFO"
    },
    "DIGITAL_ASSET": {
      // illustrative only — India's actual crypto tax rules (flat rate, no LT/ST
      // split, no loss offsetting) are a real-world example of exactly the kind of
      // shape the discriminated union in §5.5 needs to support; a pack author
      // supplies whatever this jurisdiction's actual rule is
      "kind": "FLAT_NO_HOLDING_PERIOD",
      "rate": 0.30,
      "lossOffsetAllowed": false,
      "lotSelectionDefault": "FIFO"
    }
  },

  "yieldIncome": {
    // dividends, coupon interest, staking/lending rewards — kept structurally
    // separate from capitalGains because most jurisdictions tax receipt of yield
    // differently from disposal of the underlying asset (§04 §4.3.1)
    "MARKET_LINKED_DIRECT": { "treatment": "SLAB_RATE", "taxedAt": "RECEIPT" },
    "DIGITAL_ASSET": { "treatment": "SLAB_RATE", "taxedAt": "RECEIPT" }
  },

  "withdrawalWaterfall": {
    // this is the data-driven replacement for the source doc's hardcoded
    // "Bank/FD -> MF -> PPF -> NPS" 4-step order (§3.3.4)
    "order": ["LIQUID_CASH", "FIXED_TERM_DEPOSIT", "MARKET_LINKED_POOLED", "GOV_SAFE_LOCKED", "MARKET_LINKED_MULTI_SLEEVE"],
    "lockedSleeveUnlockRule": "IRREVERSIBLE_ON_FIRST_SHORTFALL" // matches source doc's one-way flag, §3.3.4
  },

  "statutoryConstants": {
    "marketCrashFloor": -0.60,
    "defaultRiskFreeRate": 0.07
  }
}
```

The India pack above is a **direct, lossless transcription** of every
India-specific number found in `Investment_Workbook.docx` §3.1, §3.3.4, and
§3.12 — nothing new is invented, it is simply moved from spreadsheet cells
into a versioned data file.

## 5.3 What the engine contract looks like

```typescript
// packages/jurisdictions/schema.ts (illustrative excerpt)
import { z } from "zod";

export const TaxTreatmentSchema = z.enum(["EXEMPT", "SLAB_RATE", "FLAT_RATE", "CAPITAL_GAINS"]);

export const InstrumentRuleSchema = z.object({
  instrumentType: InstrumentTypeSchema,
  displayLabel: z.string(),
  // ...rule fields vary by instrumentType; validated with a discriminated union
});

export const JurisdictionPackSchema = z.object({
  packId: z.string(),
  displayName: z.string(),
  currency: z.string().length(3),
  fiscalYear: FiscalYearSchema,
  instrumentRules: z.record(z.string(), InstrumentRuleSchema),
  incomeTax: IncomeTaxSchema,
  capitalGains: z.record(InstrumentTypeSchema, CapitalGainsRuleSchema),
  withdrawalWaterfall: WithdrawalWaterfallSchema,
  statutoryConstants: z.record(z.string(), z.number()),
});

export type JurisdictionPack = z.infer<typeof JurisdictionPackSchema>;
```

Every function in `packages/engine` that needs a tax or statutory number
takes `pack: JurisdictionPack` as an explicit parameter — **never** a
module-level import of a specific country's data. This is enforced by an
ESLint rule banning imports from `packages/jurisdictions/packs/*` inside
`packages/engine/**` (only the loader and the server may import concrete
packs).

## 5.4 The withdrawal waterfall, generalized (§3.3.4 of source doc)

The source doc hardcodes a 4-step order: Bank/FD → MF → PPF → NPS, each
with its own tax rule inlined into the formula. WealthPath turns this into
a **data-driven loop**:

Note: the *order itself* is Jurisdiction Pack data (a tax-efficiency fact
about a given country), but *whether the waterfall runs at all* is a
Plan Assumption — `PlanAssumptions.withdrawalWaterfallEnabled` (default
`true`, per `04-domain-model.md` §4.5.1, found via direct workbook audit —
see `14-india-tool-gap-analysis.md` G6). When `false`, `runWithdrawalWaterfall`
is bypassed entirely in favor of a simple proportional pooled draw across
all unlocked sleeves, kept as an explicit user-facing comparison mode.

```typescript
function runWithdrawalWaterfall(
  need: number,
  sleeves: Record<InstrumentType, SleeveBalance>,
  pack: JurisdictionPack,
): WaterfallResult {
  const order = pack.withdrawalWaterfall.order;
  let remaining = need;
  const draws: Draw[] = [];

  for (const instrumentType of order) {
    if (remaining <= 0) break;
    const sleeve = sleeves[instrumentType];
    if (!sleeve || !isUnlocked(sleeve, pack.withdrawalWaterfall.lockedSleeveUnlockRule)) continue;

    const draw = Math.min(remaining, sleeve.balance);
    const tax = computeExitTax(draw, instrumentType, sleeve, pack); // dispatches per instrument's taxTreatment
    draws.push({ instrumentType, draw, tax, net: draw - tax });
    remaining -= (draw - tax);
    sleeve.balance -= draw;
  }

  return { draws, unmetNeed: Math.max(0, remaining) };
}
```

A jurisdiction with a different natural draw order (e.g. a country where
taxable brokerage accounts are drawn *before* tax-advantaged cash, or where
there is no locked-sleeve concept at all) simply supplies a different
`withdrawalWaterfall.order` array and possibly an empty locked-sleeve set —
**no code change**.

## 5.5 Handling tax models that don't fit India's shape

India's model (slab income tax + flat LTCG with an annual exemption) is one
point in a wider space. The `capitalGains` and `incomeTax` schema blocks are
deliberately typed as discriminated unions so other common global shapes
are first-class, not bolted on:

| Tax shape | Schema `kind` | Example jurisdictions |
|---|---|---|
| Progressive slab/bracket income tax | `"SLAB"` | India, US federal, UK |
| Flat-rate income tax | `"FLAT"` | Several jurisdictions with flat personal income tax |
| Long-term vs short-term capital gains split by holding period | `holdingPeriodDays` + differing rates | US, India |
| No separate capital gains tax (gains taxed as ordinary income) | `capitalGains: { "sameAsIncomeTax": true }` | Some jurisdictions |
| Tax-free growth/withdrawal wrapper (ISA/TFSA-style) accounts | `taxTreatment: "EXEMPT"` at the instrument level, independent of the general capital gains block | UK ISA, Canada TFSA |
| Contribution-deductible, taxed-on-withdrawal (EET) | `taxTreatment: { onContribution: "DEDUCTIBLE", onGrowth: "DEFERRED", onExit: "SLAB_RATE" }` | Traditional 401(k)/IRA (US), most EET pension wrappers |
| Lot-based capital gains with LT/ST holding-period split | `capitalGains.MARKET_LINKED_DIRECT.longTerm`/`.shortTerm`, per-lot | US, India (direct equity) |
| Flat-rate capital gains with no holding-period distinction and no loss offsetting (common for crypto) | `capitalGains.DIGITAL_ASSET.kind = "FLAT_NO_HOLDING_PERIOD"` | India (crypto, as of the source model's era) |
| Yield income taxed separately from the underlying asset's capital gains | `yieldIncome.<InstrumentType>`, keyed independently of `capitalGains` | Dividend taxation and staking-reward taxation in most jurisdictions |

This union is intentionally **not exhaustive at launch** — see §5.6. New
`kind` variants are added to the schema as new Jurisdiction Packs surface
tax shapes not yet covered, which is expected and by design (a schema
change is a controlled, reviewed, versioned event; it is not the same as
hardcoding a new country into the calculation engine).

## 5.6 Authoring a new Jurisdiction Pack

1. Copy `packs/GENERIC-TEMPLATE.json`, which contains every field with an
   inline comment explaining what workbook section it corresponds to and a
   placeholder value.
2. Fill in each `instrumentRules` block for the local equivalents of the
   seven `InstrumentType`s that exist in that country (not every country
   needs all seven — e.g. a country with no employer-mandatory scheme
   simply omits `EMPLOYER_MANDATORY_LOCKED`).
3. Fill in `incomeTax`, `capitalGains`, `withdrawalWaterfall`, and
   `statutoryConstants`.
4. Run `npm run jurisdiction:validate -- IN-2025` (validates against the Zod
   schema and runs a set of **cross-pack consistency checks**: every
   `InstrumentType` referenced elsewhere resolves to a defined rule block;
   percentages are within `[0,1]`; the waterfall order references only
   defined instrument rules).
5. Run `npm run jurisdiction:golden-test -- IN-2025` against that pack's
   golden-value fixture file (see `12-testing-strategy.md` §12.4) if one
   exists for that country, to catch regressions when a statutory number
   changes year over year (e.g. `IN-2025` → `IN-2026` when India's LTCG
   rate or PPF rate changes).
6. Statutory numbers change annually in most countries — the `packId`'s
   year suffix (`IN-2025`, `IN-2026`, ...) is how the app supports a user
   continuing to see prior years computed under the rules that actually
   applied, while defaulting new plans to the latest pack.

## 5.7 What is explicitly out of scope for the tax framework (v1)

- Multi-jurisdiction tax treaties / foreign tax credit computation (real,
  hard, and permanently out of scope — see `10-implementation-plan.md`'s
  non-goals list).
- State/provincial-level tax variation within a country (e.g. US state
  income tax) — v1 packs model national-level rules only; a pack's
  `incomeTax` block is documented as "national-level approximation," which
  is a step up from a single hardcoded India-only model even without going
  fully sub-national.
- Automatic annual statutory-number updates — a human must author each new
  year's pack version; this mirrors the source workbook, which also
  required the user to manually update rates like the PPF interest rate
  when the government revised it.
