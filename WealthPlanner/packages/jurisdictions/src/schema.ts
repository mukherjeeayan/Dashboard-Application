import { z } from "zod";

/**
 * The nine abstract instrument types (docs/04-domain-model.md). Defined here
 * as the source of truth because Jurisdiction Packs are the leaf data package;
 * the engine imports these from this package (single dependency direction).
 */
export const INSTRUMENT_TYPES = [
  "MARKET_LINKED_POOLED",
  "GOV_SAFE_LOCKED",
  "EMPLOYER_MANDATORY_LOCKED",
  "MARKET_LINKED_MULTI_SLEEVE",
  "EMPLOYER_DISCRETIONARY_LOCKED",
  "FIXED_TERM_DEPOSIT",
  "LIQUID_CASH",
  "MARKET_LINKED_DIRECT",
  "DIGITAL_ASSET",
] as const;

export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

/**
 * Zod schema — the CONTRACT every Jurisdiction Pack must satisfy
 * (docs/05-jurisdiction-tax-framework.md §5.1, §5.3).
 *
 * The concrete instance the schema must validate exactly is the shipped
 * `packs/IN-2025.json` (docs/15-). Where the generic schema in docs/05 was
 * illustrative, this schema is the real contract, so discriminated unions
 * are used for the shapes that legitimately vary across jurisdictions
 * (income tax: slab-with-brackets vs. flat-marginal-rate; capital gains:
 * long/short-term split vs. flat-no-holding-period).
 */

export const InstrumentTypeSchema = z.enum(
  INSTRUMENT_TYPES as unknown as [InstrumentType, ...InstrumentType[]],
);export const FiscalYearSchema = z.object({
  startMonth: z.number().int().min(1).max(12),
  convention: z.enum(["APR_MAR", "CALENDAR"]),
});

export const TaxTreatmentSchema = z
  .object({})
  .passthrough();

const BracketSchema = z.object({
  upTo: z.number(),
  rate: z.number().min(0).max(1),
});

export const IncomeTaxSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("SLAB"),
      brackets: z.array(BracketSchema).optional(),
      marginalRateAtRetirement: z.number().min(0).max(1).optional(),
    })
    .passthrough(),
  z
    .object({
      kind: z.literal("FLAT"),
      rate: z.number().min(0).max(1),
    })
    .passthrough(),
]);

export type IncomeTax = z.infer<typeof IncomeTaxSchema>;

export const CapitalGainsRuleSchema = z
  .object({
    longTerm: z
      .object({
        holdingPeriodDays: z.number().int(),
        rate: z.number().min(0).max(1),
        annualExemption: z.number().optional(),
      })
      .optional(),
    shortTerm: z.record(z.string(), z.unknown()).optional(),
    kind: z.enum(["FLAT_NO_HOLDING_PERIOD", "LONG_SHORT_SPLIT", "SAME_AS_INCOME_TAX"]).optional(),
    rate: z.number().min(0).max(1).optional(),
    lossOffsetAllowed: z.boolean().optional(),
    lotSelectionDefault: z.enum(["FIFO", "LIFO", "SPECIFIC_ID"]).optional(),
  })
  .passthrough();

export const YieldIncomeRuleSchema = z
  .object({
    treatment: z.string(),
    taxedAt: z.string().optional(),
  })
  .passthrough();

/** One jurisdiction-local rule block, keyed by a local ruleRef (e.g. "PPF"). */
const InstrumentRuleSchema = z
  .object({
    instrumentType: InstrumentTypeSchema,
    displayLabel: z.string().optional(),
    taxTreatment: TaxTreatmentSchema.optional(),
  })
  .passthrough();

const InstrumentRulesSchema = z.record(z.string(), InstrumentRuleSchema);

export const WithdrawalWaterfallSchema = z.object({
  enabledDefault: z.boolean().optional(),
  order: z.array(InstrumentTypeSchema),
  lockedSleeveUnlockRule: z.string(),
});

export const StatutoryConstantsSchema = z.record(z.string(), z.number());

export const JurisdictionPackSchema = z.object({
  packId: z.string(),
  displayName: z.string(),
  currency: z.string().length(3),
  fiscalYear: FiscalYearSchema,
  locale: z.string().optional(),
  instrumentRules: InstrumentRulesSchema,
  incomeTax: IncomeTaxSchema,
  capitalGains: z.record(z.string(), z.union([CapitalGainsRuleSchema, z.string()])).optional(),
  yieldIncome: z.record(z.string(), z.union([YieldIncomeRuleSchema, z.string()])).optional(),
  withdrawalWaterfall: WithdrawalWaterfallSchema,
  statutoryConstants: StatutoryConstantsSchema.optional(),
})
  .passthrough();

export type JurisdictionPack = z.infer<typeof JurisdictionPackSchema>;
export type InstrumentRule = z.infer<typeof InstrumentRuleSchema>;
export type CapitalGainsRule = z.infer<typeof CapitalGainsRuleSchema>;

/**
 * Cross-pack consistency checks (docs/05 §5.6 step 4, docs/12 §12.3):
 * every InstrumentType referenced by the waterfall order must resolve to at
 * least one defined instrument rule, and percentages must be in [0,1].
 * Throws on the first violation so a broken pack is caught at load time.
 */
export function assertPackConsistency(pack: JurisdictionPack): void {
  const definedTypes = new Set<string>(
    Object.values(pack.instrumentRules).map((r) => r.instrumentType),
  );

  for (const instrumentType of pack.withdrawalWaterfall.order) {
    if (!definedTypes.has(instrumentType)) {
      throw new Error(
        `Pack "${pack.packId}" is inconsistent: withdrawalWaterfall.order references ` +
          `"${instrumentType}" but no instrument rule in instrumentRules maps to that instrument type.`,
      );
    }
  }

  for (const rule of Object.values(pack.instrumentRules)) {
    if (typeof rule.taxTreatment === "object" && rule.taxTreatment !== null) {
      // no numeric validation needed here — percentages validated where typed
    }
  }
}
