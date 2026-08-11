# 04. Generalized Domain Model

This is the single most important document for the "generalize for the
entire world" requirement. It replaces the workbook's seven named,
India-specific instruments with an abstract taxonomy that any country's real
products map onto.

## 4.1 The core insight from the source model

Reading `Investment_Workbook.docx` §3.1 closely, every one of the seven
instruments is really just **one recursive compounding pattern** —

```
Balance(t) = [Actual(t-1) if reconciled, else Projected(t-1)] × (1 + ROI(t)) + Contribution(t)
```

— with five axes of variation layered on top:

1. **How ROI is determined** (flat rate / stochastic draw / weighted blend
   of sub-sleeves / per-position discrete rate).
2. **How Contribution is determined** (statutory formula off salary /
   fixed periodic amount / lump-sum, discrete per position).
3. **Liquidity** (freely accessible / locked until a trigger event).
4. **Tax treatment at contribution, growth, and exit** (this axis is
   entirely delegated to the Jurisdiction Pack — see `05-`).
5. **Position structure** — added in this revision, see §4.2.1 — whether
   the account is tracked as a single blended balance (`POOLED_BALANCE`,
   the only mode the source workbook ever needed) or as **discrete,
   individually-costed lots** (`DISCRETE_LOTS`, needed for anything traded
   at a per-unit market price: direct stocks, bonds, and crypto).

Instrument *names* (PPF, EPF, NPS, ...) are just India's labels for
specific combinations of these five axes. WealthPath models the axes, not
the names.

### 4.1.1 Why direct stocks and crypto don't fit the original seven types

None of the source workbook's seven instruments are traded at a per-unit
market price with an acquisition-date-specific cost basis — a mutual fund
is NAV-based (one blended unit price the fund itself publishes), and PPF/
EPF/NPS/Superannuation/FD/Bank are all rate-declared or statutory. Direct
stock holdings and crypto are structurally different: a user owns a
specific *quantity* acquired at a specific *price* on a specific *date*,
and realized capital gains are computed **per lot**, not off a single
blended balance. Forcing these into `MARKET_LINKED_POOLED` (the closest
existing type) would silently produce wrong capital-gains tax, since NAV-
style average-cost accounting and lot-based FIFO/LIFO/specific-ID
accounting are genuinely different calculations, not a cosmetic relabeling.
§4.2.1 adds two new instrument types built on a shared `Lot` entity to
handle this correctly, rather than approximating it.

## 4.2 The seven Abstract Instrument Types

| Type ID | Generic description | India examples (for reference only) | Typical global examples |
|---|---|---|---|
| `MARKET_LINKED_POOLED` | Professionally managed pooled investment; NAV-based; contributions typically periodic (SIP-style) or lump sum; ROI is flat-assumed or stochastic | Mutual Fund | Mutual funds, ETFs, unit trusts, index funds |
| `GOV_SAFE_LOCKED` | Government-backed, flat/declared-rate, tax-advantaged, statutory contribution cap, fixed lock-in period with defined extension rules | PPF | Roth/Traditional IRA (US), ISA (UK), TFSA (Canada), Superannuation (Australia — note: name collision with India's employer scheme, see §4.4) |
| `EMPLOYER_MANDATORY_LOCKED` | Compulsory salary-linked contribution, employer-matched, statutory rate, government-administered, locked until retirement/job-change trigger | EPF/PF | 401(k) (US, though usually voluntary %), Superannuation Guarantee (Australia), auto-enrolment workplace pension (UK) |
| `MARKET_LINKED_MULTI_SLEEVE` | Contributions split across investor-chosen sub-sleeves (e.g. equity/govt-debt/corp-debt) with a weighted blended return; often has statutory exit-split rules (partial lump sum + partial annuitized) | NPS | 401(k)/403(b) with self-directed sub-fund allocation, DC pension schemes with fund choice |
| `EMPLOYER_DISCRETIONARY_LOCKED` | Employer-funded (not employee-funded), simpler flat-rate growth, locked until separation/retirement | Superannuation (India, employer scheme) | Defined-benefit-adjacent employer top-ups, employer pension contributions in various DC schemes |
| `FIXED_TERM_DEPOSIT` | Discrete, per-position ledger (own principal/rate/maturity date), not blended; reinvestment-rate assumption on maturity | Fixed Deposit | CDs (US), Term Deposits (Australia/UK), Festgeld (Germany) |
| `LIQUID_CASH` | Fully liquid, no lock-in, low/no growth | Bank Savings Account | Checking/savings accounts globally |

**Design rule:** the engine (`packages/engine`) only ever operates on these
`InstrumentType` values plus the five axes above. It never contains a
country name, a currency symbol, or a statutory number. Every one of those
lives in a Jurisdiction Pack (`05-jurisdiction-tax-framework.md`).

### 4.2.0a Liquidity is a decoupled field, not an implicit property of type (revised — see `14-india-tool-gap-analysis.md` G3)

Earlier drafts of this document treated liquidity as implied by
`InstrumentType` (e.g. "`GOV_SAFE_LOCKED` is locked, `LIQUID_CASH` is
liquid") with liquidity overrides mentioned only for the two lot-based
types. Auditing the real workbook surfaced a case that breaks that
shortcut: **Real Estate & Physical Assets** — tracked in the source model
as a simple appreciating balance (current value × expected appreciation
rate, no contributions), structurally identical to a plain
`MARKET_LINKED_POOLED` account, but **always illiquid** for reasons that
have nothing to do with statutory lock-in (you can't sell a fraction of a
house to fund a monthly withdrawal) and everything to do with the asset
itself.

Every `Account` therefore carries an explicit, first-class field:

```typescript
type Liquidity =
  | "LIQUID"                 // can fund a withdrawal directly, any time
  | "LOCKED_STATUTORY"        // locked by law/contract until a defined trigger (PPF lock-in, EPF, vesting)
  | "ILLIQUID_DISCRETIONARY"; // liquid "in principle" but requires a discrete sale to realize (real estate, private equity, unlisted assets)
```

Each `InstrumentType` still has a **sensible default** (e.g.
`GOV_SAFE_LOCKED` defaults to `LOCKED_STATUTORY`, `MARKET_LINKED_POOLED`
defaults to `LIQUID`), but the field is always present and always
overridable per account — real estate is simply a `MARKET_LINKED_POOLED`
account with `contributionRule: NONE`, `roiRule: { kind: "FLAT", rate:
<appreciation rate> }`, and `liquidity: "ILLIQUID_DISCRETIONARY"`. No new
instrument type was needed once liquidity stopped being baked into type
identity — this is a strictly better fit than adding an eighth or ninth
type for "things that just appreciate and can't be sold piecemeal," since
that description also covers private equity, unlisted PMS units, and
collectibles, none of which need their own type either.

The drawdown engine's liquidity-aware funding order (`06-` §6.3) and the
lot-based accounts' liquidity note (§4.2.1 below) both now read from this
one field rather than switching on `InstrumentType`.

## 4.2.1 Two additional Abstract Instrument Types: lot-based holdings

These two types share the same `positionStructure: "DISCRETE_LOTS"` and the
same `Lot` entity (§4.3), differing only in `displayLabel` defaults, the
presence of a yield-income concept (dividends), and, per Jurisdiction Pack,
how their gains are actually taxed (many jurisdictions tax crypto
differently from listed securities even though the accounting mechanics
are identical).

| Type ID | Generic description | Typical examples |
|---|---|---|
| `MARKET_LINKED_DIRECT` | Individually-held, exchange-traded securities bought/sold at a per-unit market price; per-lot cost basis; may pay periodic yield income (dividends/coupons) separate from price appreciation | Individual stocks, direct bonds, ETF shares held in a self-directed brokerage account |
| `DIGITAL_ASSET` | Individually-held digital/crypto assets bought/sold at a per-unit market price; per-lot cost basis; may generate yield income (staking/lending rewards) distinct from price appreciation; typically no fixed exchange hours or fiscal-year-end market closure to key valuation off | Bitcoin, Ethereum, other cryptocurrencies and tokens |

Both types default to `liquidity: "LIQUID"` (per §4.2.0a), though an
account-level override may mark a specific holding illiquid or locked
(e.g. a vesting-restricted employee stock grant would set `liquidity:
"LOCKED_STATUTORY"` on an otherwise-`MARKET_LINKED_DIRECT` account).

**Why these are two separate type IDs rather than one "lot-based asset"
type:** tax treatment genuinely diverges per jurisdiction — several
countries treat cryptocurrency as property subject to different
short/long-term thresholds than listed securities, tax staking rewards as
ordinary income at receipt (not at sale), or classify certain tokens as
securities entirely. Keeping them distinct lets a Jurisdiction Pack express
"stocks get the standard 1-year LTCG split, but crypto gains are always
taxed as ordinary income regardless of holding period" — a real rule in
some jurisdictions — without a conditional branch inside the engine.
Countries where both are taxed identically simply point both types at the
same `capitalGains` rule block (§05 §5.2).

## 4.3 Core entities

```typescript
// packages/engine/types.ts (illustrative — full schema lives in packages/jurisdictions + Drizzle schema)

type InstrumentType =
  | "MARKET_LINKED_POOLED"
  | "GOV_SAFE_LOCKED"
  | "EMPLOYER_MANDATORY_LOCKED"
  | "MARKET_LINKED_MULTI_SLEEVE"
  | "EMPLOYER_DISCRETIONARY_LOCKED"
  | "FIXED_TERM_DEPOSIT"
  | "LIQUID_CASH"
  | "MARKET_LINKED_DIRECT"   // added: individual stocks/bonds, lot-based
  | "DIGITAL_ASSET";          // added: crypto, lot-based

type PositionStructure = "POOLED_BALANCE" | "DISCRETE_LOTS";

type Liquidity = "LIQUID" | "LOCKED_STATUTORY" | "ILLIQUID_DISCRETIONARY"; // see §4.2.0a

interface Holder {
  id: string;
  name: string;
  relationshipToPlanOwner: string; // e.g. "Self", "Spouse", "Child", "Parent" — free text, not an enum, since real-world relationships vary too much to enumerate
}

interface Account {
  id: string;
  label: string;                 // user-chosen display name, e.g. "Vanguard Roth IRA"
  instrumentType: InstrumentType;
  positionStructure: PositionStructure; // POOLED_BALANCE for the original 7 types; DISCRETE_LOTS for MARKET_LINKED_DIRECT / DIGITAL_ASSET
  liquidity: Liquidity;            // explicit, decoupled from instrumentType — see §4.2.0a. Defaults per type, always overridable.
  jurisdictionRuleRef: string;    // which rule block within the active Jurisdiction Pack governs this account
  currency: string;               // ISO 4217, may differ from plan base currency
  openedDate: string;
  primaryHolderRef: string;        // references a Holder — every account has exactly one primary holder
  jointHolderRefs?: string[];        // zero or more additional Holders (e.g. a joint bank account or FD)
  nomineeRef?: string;                 // references a Holder designated as nominee — optional, surfaced as a visibility checklist item, not enforced
  sleeves?: SleeveAllocation[];    // only for MARKET_LINKED_MULTI_SLEEVE
  positions?: TermDepositPosition[]; // only for FIXED_TERM_DEPOSIT
  lots?: Lot[];                       // only for positionStructure === "DISCRETE_LOTS"
  lotSelectionMethod?: "FIFO" | "LIFO" | "SPECIFIC_ID"; // only for DISCRETE_LOTS accounts — see §4.3.1
  contributionRule: ContributionRule;
  roiRule: ROIRule;
  oneTimeAdjustments: OneTimeAdjustment[]; // discrete, dated, signed one-off amounts — see §4.3.2
  actualBalanceHistory: ReconciliationEntry[]; // the "Actual overrides Projected" pattern, §3.1 of source doc
  dataHealth: { lastUpdated: string };
}

// A discrete one-off addition (positive) or withdrawal (negative) against an
// account for a specific period, distinct from the account's regular
// periodic ContributionRule. See §4.3.2 and 14-india-tool-gap-analysis.md G1.
interface OneTimeAdjustment {
  id: string;
  date: string;
  amount: number;                    // signed: positive = addition, negative = withdrawal
  description?: string;
  linkedTransferRef?: string;         // optional: when this adjustment is one leg of a transfer between two of the user's own accounts (e.g. FD -> MF rebalancing), points at the OneTimeAdjustment.id of the paired leg on the other account, so the pair can be displayed and validated together without inventing a separate "Transfer" entity
}

// Shared by MARKET_LINKED_DIRECT and DIGITAL_ASSET — one row per acquisition event.
interface Lot {
  id: string;
  ticker: string;                  // e.g. "AAPL", "BTC" — free text, no live lookup/validation in v1
  quantity: number;                 // supports fractional units (crypto, fractional shares)
  acquisitionDate: string;
  acquisitionPricePerUnit: number;   // user-entered, in the account's currency
  costBasisAdjustments?: CostBasisAdjustment[]; // manual entries for splits, spin-offs, hard forks, airdrops
  disposals: LotDisposal[];            // partial or full sales against this lot, appended over time
}

interface LotDisposal {
  id: string;
  date: string;
  quantity: number;                 // may be less than the lot's remaining quantity (partial sale)
  pricePerUnit: number;               // user-entered sale price
  realizedGain: number;                // computed at entry time: (pricePerUnit - costBasisPerUnit) * quantity
}

interface CostBasisAdjustment {
  date: string;
  type: "SPLIT" | "SPIN_OFF" | "HARD_FORK" | "AIRDROP" | "OTHER";
  quantityMultiplier?: number;   // e.g. 2.0 for a 2-for-1 split
  note: string;                    // free text — these events are too varied to fully model structurally; user documents the adjustment and its effect
}

interface Plan {
  id: string;
  ownerProfile: OwnerProfile;         // DOB, retirement age target, base currency, home jurisdiction
  jurisdictionPackId: string;          // which Jurisdiction Pack + version governs tax/statutory logic
  holders: Holder[];                    // every named person who appears as a primary/joint holder or nominee anywhere in the plan — includes the plan owner
  accounts: Account[];
  goals: Goal[];
  liabilities: Liability[];
  insurancePolicies: InsurancePolicy[];
  emergencyFund: EmergencyFundConfig;
  majorExpenses: MajorExpense[];
  assumptions: PlanAssumptions;         // the single "Assumptions tab" equivalent — see §4.5
}
```

### 4.3.2 One-time adjustments vs. periodic contributions

`OneTimeAdjustment` (§4.3) exists because a real portfolio has events a
recurring `ContributionRule` can't express: a bonus dropped into a mutual
fund mid-year, a partial FD break funding that MF addition, an inheritance,
a one-off medical withdrawal from a locked account. These are **discrete,
dated, and irregular** — the opposite of what `ContributionRule` (periodic,
statutory, or capped) is built to model.

The compounding engine (`06-` §6.1) folds a year's `oneTimeAdjustments`
into that year's balance alongside the regular `contribution(t)` term, so
no separate formula path is needed. When two adjustments are opposite legs
of the same real-world transfer (money moved from one of the user's
accounts to another, not new or withdrawn money), `linkedTransferRef` lets
the UI show and validate them as a pair — e.g. warning if a linked pair's
amounts don't net to zero — without introducing a first-class `Transfer`
entity that would duplicate what two `OneTimeAdjustment` rows already say.

### 4.3.1 How valuation and gains work for lot-based accounts (no live price feed)

Consistent with the "no import, no live data feed" constraint
(`01-product-overview.md` §1.5), current market prices are **entered
manually**, exactly like the reconciliation pattern the rest of the app
already uses:

- **Unrealized value** (shown on the Overview/Projection dashboards): the
  user periodically enters a current price-per-unit for a ticker (a single
  manual entry, reused across every lot of that ticker in that account —
  not re-entered per lot). `unrealizedValue = Σ lot.remainingQuantity ×
  currentPricePerUnit`. This is the direct lot-based analogue of the
  existing "Balance Reconciliation" screen (§08 §8.4) — same manual-entry
  philosophy, applied per ticker instead of per account.
- **Realized gains** (feeds the tax engine, §06 §6.9): computed at the
  moment the user records a `LotDisposal` — which lot(s) it's drawn against
  is resolved by `lotSelectionMethod` (FIFO is the default and the most
  jurisdiction-portable choice; some jurisdictions require or permit
  specific-lot identification, which the Jurisdiction Pack can indicate as
  the default for that country — see §05 §5.2).
- **Projection/Monte Carlo** (forward-looking, no real price exists yet):
  lot-based accounts project forward exactly like `MARKET_LINKED_POOLED`
  does today — a flat-assumed or stochastic ROI applied to the account's
  *current total value* (Σ lots' latest valuation), not to individual
  lots. Per-lot cost-basis tracking only matters for **realized, historical**
  tax computation, not for forward projection — projection doesn't need to
  know which specific lot a future sale will draw from.
- **Yield income** (dividends, staking rewards): recorded as a separate,
  dated income entry per account, taxed per the Jurisdiction Pack's
  yield-income rule for that instrument type (§05 §5.2) — kept structurally
  distinct from capital gains, since many jurisdictions tax the two very
  differently (e.g. dividends taxed on receipt at ordinary-income rates;
  capital gains taxed on disposal at capital-gains rates).

### 4.3.1a Unit/NAV entry as an alternate input mode for pooled accounts

`POOLED_BALANCE` accounts (the original seven types) are consumed by the
engine as a single `currentBalance` figure. For some pooled holdings a
user may find it more natural — and more auditable — to enter a quantity
and a price-per-unit instead of a lump balance (e.g. "3.793 units of HDFC
Flexi Cap Fund at ₹2,300.26" rather than "₹8,724.89"), the same mental
model as the lot-based accounts above but without any need for cost basis
or disposal tracking, since the only thing being tracked is *current
value*, not a future taxable sale.

This is purely a **data-entry convenience**, not a new engine concept:
`unitsHeld × pricePerUnit` is computed at entry time and written into the
same `actualBalanceHistory` reconciliation record a direct-balance entry
would use. The engine never sees "units" as a concept for
`POOLED_BALANCE` accounts — only `currentBalance`. The UI simply offers a
toggle, on the Balance Reconciliation screen (`09-` §9.1), between "enter
balance directly" and "enter units × price," per account, at the user's
preference.

## 4.4 Naming collisions are expected — handled by scoping, not renaming

Some real-world product names collide across countries (e.g. "Superannuation"
means an employer-mandatory scheme in Australia but is the employer's
*voluntary/discretionary* top-up scheme in the source Excel model's India
context). WealthPath never uses product names as type identifiers for this
reason — the seven `InstrumentType` values above are deliberately
behavior-described, not name-based. Each Jurisdiction Pack supplies its own
**display labels** (e.g. India's pack labels `GOV_SAFE_LOCKED` accounts as
"PPF" in the UI; the US pack labels the same abstract type "IRA").

## 4.5 The "single Assumptions tab" principle, generalized

The source workbook's most important design discipline (§2.2 of source doc)
is that **every editable assumption lives in exactly one place**, and every
other tab pulls from it live. WealthPath keeps this discipline but splits
"assumptions" into two tiers, because the generalization requires it:

| Tier | Lives where | Examples | Editable by user? |
|---|---|---|---|
| **Plan Assumptions** | `PlanAssumptions` on the `Plan` entity, stored in the local DB | Market CAGR, volatility, inflation model parameters, retirement age, glide-path shape, scenario definitions, Monte Carlo trial count, RNG seed, lifestyle-stress expense multiplier, market-return-source selector, withdrawal-waterfall enable/disable toggle (§4.5.1) | Yes — this is the direct equivalent of the source workbook's Assumptions tab |
| **Jurisdiction Rules** | Jurisdiction Pack file, versioned, not stored per-plan | Tax brackets, LTCG rates/exemptions, statutory contribution caps, EEE/EET/TEE treatment, fiscal-year convention, withdrawal draw order | Not directly editable in the UI in v1 (advanced users can author a custom Jurisdiction Pack — see `05-` §5.6) — this split is precisely what makes "maintained by different tax jurisdictions" tractable: statutory rules change on a government's schedule, not the user's, so they're versioned data, not a form field |

This two-tier split is the key structural change from the source workbook,
where both tiers were flattened into one Assumptions tab because only one
jurisdiction (India) ever existed in the model.

### 4.5.1 Withdrawal Waterfall Enabled toggle (added — see `14-india-tool-gap-analysis.md` G6)

Alongside the Plan Assumptions already named above, the real workbook's
`Assumptions` tab carries one more boolean not previously captured:
**Withdrawal Waterfall Enabled** (default `true`). When `false`, the
drawdown engine falls back to a simple pooled draw across the liquid
corpus with no tax-efficient sequencing — kept as an explicit,
user-selectable comparison mode against the data-driven waterfall (`05-`
§5.4), rather than the waterfall being the only option. This lets a user
see how much the tax-aware sequencing is actually worth versus a naive
pooled draw.

### 4.5.2 Live single-path stochastic redraw vs. batch Monte Carlo — two distinct concepts

The source workbook has **two different stochastic mechanisms** that are
easy to conflate (see `14-india-tool-gap-analysis.md` C1 for the
Market-Return-Source selector these both draw from):

1. **A live, single-path redraw** on the Projection sheet itself: when
   stochastic mode is on, every recalculation draws one fresh random
   annual return per year and shows the resulting single corpus path
   directly on the main dashboard — in Excel, triggered by Ctrl+Alt+F9.
   This answers "what does one plausible random future look like right
   now."
2. **A batch Monte Carlo run** (§07): thousands of trials, summarized as
   P10/P50/P90 percentile curves and a probability-of-success figure.
   This answers "across many plausible futures, how often does the plan
   succeed."

Both draw from the same underlying return-generation methodology, but they
are **different UI surfaces with different triggers** — see `09-` §9.4 for
how this is represented as two distinct, explicitly-triggered actions
rather than one screen silently reusing the other's random state.

## 4.6 Multi-currency handling (v1 scope)

- Each `Plan` has one **base currency** chosen at profile setup, tied to the
  Jurisdiction Pack's default currency but independently overridable (an
  expat living in the US on an Indian plan is a real case).
- Each `Account` may hold a different currency than the plan's base
  currency; the user manually enters an FX rate snapshot at time of entry
  (no live FX feed in v1, consistent with "no import functionality" and the
  no-live-data-feed non-goal in `01-product-overview.md`). Multi-currency
  live conversion is flagged as a Phase 6+ candidate in
  `10-implementation-plan.md`.
- All computed dashboards display in the plan's base currency.

## 4.7 What stays literally the same as the source model

To be explicit about what does *not* need generalizing — these are already
jurisdiction-agnostic in the source workbook and carry over unchanged:

- The two-sleeve (Locked vs. Liquid) drawdown structure (§3.3.1) — locked
  vs. liquid is a liquidity property of `InstrumentType`, not a tax concept.
- The growing-annuity closed-form shortcut (§3.4).
- Sequence-of-returns risk methodology (§3.5).
- The Guyton–Klinger-style guardrail withdrawal rule (§3.6).
- Portfolio variance/HHI concentration math (§3.7).
- All three Monte Carlo engine structures (§3.8–3.10) — only the *tax
  waterfall step* they call into is jurisdiction-specific; the simulation
  mechanics are universal.
- Goal funding math (§3.11), loan amortization (§3.15), emergency fund
  real-purchasing-power tracking (§3.13) — none of these are India-specific
  in the source model.

## 4.8 What required genuinely new modeling (not present in the source workbook)

To be explicit about the one place this domain model goes beyond a
generalization of the source workbook rather than just abstracting it:
**lot-based position tracking (§4.2.1, §4.3.1) is new** — the source Excel
model never needed it, because none of its seven instruments are traded at
a per-unit market price. This is called out separately from the rest of
this document (which is purely a generalization of existing logic) so a
reviewer knows exactly which piece was designed from scratch rather than
ported, and can scrutinize it accordingly.
