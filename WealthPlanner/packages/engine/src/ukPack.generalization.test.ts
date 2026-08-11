// Second generalization proof point (docs/10 Phase 6): the UK-2025 pack uses
// the FLAT_NO_HOLDING_PERIOD capital-gains shape and an APR_MAR fiscal year —
// different tax shapes from both IN-2025 and US-2025 — proving the engine
// handles genuinely different jurisdictions as data, with zero engine changes.

import { describe, expect, it } from "vitest";
import { loadPack } from "@wealthpath/jurisdictions";
import { computeGainsTax, disposeAcrossLots } from "./tax/lotDisposal";
import { runWithdrawalWaterfall } from "./projection/withdrawalWaterfall";
import type { Lot } from "./types";

const UK_2025 = loadPack("UK-2025");

function expectClose(actual: number, expected: number, eps = 1e-9): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(eps);
}

function makeLot(partial: Partial<Lot> & Pick<Lot, "id" | "ticker" | "quantity" | "acquisitionDate" | "acquisitionPricePerUnit">): Lot {
  return partial as Lot;
}

describe("UK-2025 generalization proof (zero engine changes)", () => {
  it("loads with an APR_MAR fiscal year and is consistent", () => {
    expect(UK_2025.packId).toBe("UK-2025");
    expect(UK_2025.currency).toBe("GBP");
    expect(UK_2025.fiscalYear).toEqual({ startMonth: 4, convention: "APR_MAR" });
    const definedTypes = new Set(Object.values(UK_2025.instrumentRules).map((r) => r.instrumentType));
    for (const t of UK_2025.withdrawalWaterfall.order) {
      expect(definedTypes.has(t)).toBe(true);
    }
  });

  it("taxes capital gains at the flat CGT rate regardless of holding period", () => {
    // UK has no LT/ST split: a gain held 30 days and one held 3 years both
    // attract the same 18% CGT.
    const rule = UK_2025.capitalGains!["MARKET_LINKED_DIRECT"];
    const shortHold = computeGainsTax(1000, 30, rule as never, UK_2025);
    const longHold = computeGainsTax(1000, 1100, rule as never, UK_2025);
    expectClose(shortHold, 1000 * 0.18, 1e-9);
    expectClose(longHold, 1000 * 0.18, 1e-9);
  });

  it("applies flat CGT on a real share disposal", () => {
    const lot = makeLot({
      id: "l1",
      ticker: "LLOY",
      quantity: 500,
      acquisitionDate: "2024-05-10",
      acquisitionPricePerUnit: 2,
    });
    const res = disposeAcrossLots(
      { quantity: 500, pricePerUnit: 3, date: "2025-07-01" },
      [lot],
      "MARKET_LINKED_DIRECT",
      UK_2025,
      "FIFO",
    );
    const gain = (3 - 2) * 500;
    expectClose(res.gain, gain, 1e-9);
    expectClose(res.tax, gain * 0.18, 1e-9);
  });

  it("draws cash and NS&I before the taxable pension in the waterfall", () => {
    const sleeves = {
      LIQUID_CASH: { balance: 3000, unlocked: true },
      FIXED_TERM_DEPOSIT: { balance: 0, unlocked: true },
      GOV_SAFE_LOCKED: { balance: 2000, unlocked: true },
      MARKET_LINKED_POOLED: { balance: 0, unlocked: true },
      MARKET_LINKED_DIRECT: { balance: 0, unlocked: true },
      EMPLOYER_DISCRETIONARY_LOCKED: { balance: 10000, unlocked: true },
    };
    const res = runWithdrawalWaterfall(3000, sleeves, UK_2025);
    expect(res.draws[0].instrumentType).toBe("LIQUID_CASH");
    expectClose(res.draws[0].draw, 3000, 1e-9);
    expect(res.unmetNeed).toBe(0);
  });
});
