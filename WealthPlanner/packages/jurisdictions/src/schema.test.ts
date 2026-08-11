import { describe, expect, it } from "vitest";
import { JurisdictionPackSchema, assertPackConsistency } from "./schema";
import { loadPack, listPackIds, clearPackCache } from "./loader";

// The India pack is the concrete authority for the schema shape (docs/15 §15.2).
const IN_2025 = () => loadPack("IN-2025");
// The US pack is the second jurisdiction, proving generalization (docs/10 Phase 6).
const US_2025 = () => loadPack("US-2025");

describe("JurisdictionPack schema fidelity (IN-2025)", () => {
  it("ships and validates the IN-2025 pack", () => {
    expect(listPackIds()).toContain("IN-2025");
    const pack = IN_2025();
    expect(pack.packId).toBe("IN-2025");
    expect(pack.currency).toBe("INR");
  });

  it("round-trips every instrumentRules entry and resolves the waterfall order", () => {
    const pack = IN_2025();
    // Every InstrumentType named in the waterfall order is implemented.
    const definedTypes = new Set(
      Object.values(pack.instrumentRules).map((r) => r.instrumentType),
    );
    for (const t of pack.withdrawalWaterfall.order) {
      expect(definedTypes.has(t)).toBe(true);
    }
    // The specific India mappings from docs/05 §5.2.
    expect(pack.instrumentRules["PPF"].instrumentType).toBe("GOV_SAFE_LOCKED");
    expect(pack.instrumentRules["MF"].instrumentType).toBe("MARKET_LINKED_POOLED");
    expect(pack.instrumentRules["NPS"].instrumentType).toBe("MARKET_LINKED_MULTI_SLEEVE");
  });

  it("keeps the key statutory numbers from the source workbook", () => {
    const pack = IN_2025();
    expect(pack.instrumentRules["PPF"].declaredRate).toBeCloseTo(0.071, 10);
    expect(pack.instrumentRules["PF"].declaredRate).toBeCloseTo(0.0825, 10);
    expect(pack.instrumentRules["PF"].employeeRate).toBe(0.12);
    expect(pack.instrumentRules["NPS"].perDrawTaxableFraction).toBe(0.4);
    expect(pack.capitalGains?.["MARKET_LINKED_POOLED"].longTerm?.rate).toBeCloseTo(0.125, 10);
    expect(pack.capitalGains?.["DIGITAL_ASSET"].kind).toBe("FLAT_NO_HOLDING_PERIOD");
    expect(pack.incomeTax.marginalRateAtRetirement).toBe(0.3);
  });
});

describe("US-2025 second pack (generalization proof)", () => {
  it("ships and validates the US-2025 pack", () => {
    expect(listPackIds()).toContain("US-2025");
    const pack = US_2025();
    expect(pack.packId).toBe("US-2025");
    expect(pack.currency).toBe("USD");
    expect(pack.fiscalYear.convention).toBe("CALENDAR");
  });

  it("resolves the waterfall order against its instrument rules", () => {
    const pack = US_2025();
    const definedTypes = new Set(
      Object.values(pack.instrumentRules).map((r) => r.instrumentType),
    );
    for (const t of pack.withdrawalWaterfall.order) {
      expect(definedTypes.has(t)).toBe(true);
    }
    expect(pack.withdrawalWaterfall.order).toContain("EMPLOYER_DISCRETIONARY_LOCKED");
  });

  it("models US long-term gains at 15% with no annual exemption", () => {
    const pack = US_2025();
    expect(pack.capitalGains?.["MARKET_LINKED_DIRECT"].longTerm?.rate).toBeCloseTo(0.15, 10);
    expect(pack.capitalGains?.["MARKET_LINKED_DIRECT"].longTerm?.annualExemption).toBe(0);
    expect(pack.capitalGains?.["MARKET_LINKED_DIRECT"].longTerm?.holdingPeriodDays).toBe(366);
  });
});

describe("JurisdictionPack validation", () => {
  it("does not surface the GENERIC-TEMPLATE as a usable jurisdiction", () => {
    expect(listPackIds()).not.toContain("GENERIC-TEMPLATE");
    // But the template itself still loads/validates on demand.
    expect(loadPack("GENERIC-TEMPLATE").packId).toBe("XX-YYYY");
  });

  it("rejects a pack with an unknown instrumentType in instrumentRules", () => {
    const bad = {
      ...IN_2025(),
      instrumentRules: {
        ...IN_2025().instrumentRules,
        BOGUS: { instrumentType: "NOT_A_TYPE", displayLabel: "x" },
      },
    };
    const res = JurisdictionPackSchema.safeParse(bad);
    expect(res.success).toBe(false);
  });

  it("rejects a malformed fiscalYear", () => {
    const bad = { ...IN_2025(), fiscalYear: { startMonth: 13, convention: "APR_MAR" } };
    expect(JurisdictionPackSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a waterfall order referencing an unimplemented instrument type", () => {
    const bad: unknown = {
      ...IN_2025(),
      withdrawalWaterfall: { ...IN_2025().withdrawalWaterfall, order: ["DIGITAL_ASSET"] },
    };
    const parsed = JurisdictionPackSchema.safeParse(bad);
    expect(parsed.success).toBe(true);
    // DIGITAL_ASSET has no instrument rule in the India pack, so consistency fails.
    expect(() => assertPackConsistency(parsed.success ? parsed.data : ({} as never))).toThrow();
  });
});

describe("loader", () => {
  it("caches loaded packs and throws on missing id", () => {
    clearPackCache();
    expect(() => loadPack("NOPE-9999")).toThrow(/not found/);
    const a = loadPack("IN-2025");
    const b = loadPack("IN-2025");
    expect(a).toBe(b); // cached instance
  });
});
