// Generalization proof (docs/05 §5.6, docs/10 Phase 6 exit criteria): the
// US-2025 pack is a SECOND Jurisdiction Pack authored with ZERO changes to
// packages/engine. This suite runs the engine's own functions against that
// pack to prove the engine is genuinely jurisdiction-agnostic — a new country
// is data, not code.

import { describe, expect, it } from "vitest";
import { loadPack } from "@wealthpath/jurisdictions";
import { computeGainsTax, disposeAcrossLots } from "./tax/lotDisposal";
import { runWithdrawalWaterfall } from "./projection/withdrawalWaterfall";
import type { Lot } from "./types";

const US_2025 = loadPack("US-2025");

function expectClose(actual: number, expected: number, eps = 1e-9): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(eps);
}

function makeLot(partial: Partial<Lot> & Pick<Lot, "id" | "ticker" | "quantity" | "acquisitionDate" | "acquisitionPricePerUnit">): Lot {
  return partial as Lot;
}

describe("US-2025 generalization proof (zero engine changes)", () => {
  it("loads and is internally consistent", () => {
    expect(US_2025.packId).toBe("US-2025");
    expect(US_2025.currency).toBe("USD");
    expect(US_2025.fiscalYear.convention).toBe("CALENDAR");
    const definedTypes = new Set(Object.values(US_2025.instrumentRules).map((r) => r.instrumentType));
    for (const t of US_2025.withdrawalWaterfall.order) {
      expect(definedTypes.has(t)).toBe(true);
    }
  });

  it("draws taxable accounts before tax-deferred 401(k) in the waterfall", () => {
    const sleeves = {
      LIQUID_CASH: { balance: 5000, unlocked: true },
      FIXED_TERM_DEPOSIT: { balance: 0, unlocked: true },
      MARKET_LINKED_POOLED: { balance: 0, unlocked: true },
      MARKET_LINKED_DIRECT: { balance: 0, unlocked: true },
      GOV_SAFE_LOCKED: { balance: 0, unlocked: true },
      EMPLOYER_DISCRETIONARY_LOCKED: { balance: 20000, unlocked: true },
    };
    const res = runWithdrawalWaterfall(10000, sleeves, US_2025);
    // LIQUID_CASH drawn first (already-taxed corpus → no exit tax).
    expect(res.draws[0].instrumentType).toBe("LIQUID_CASH");
    expectClose(res.draws[0].draw, 5000, 1e-9);
    expectClose(res.draws[0].tax, 0, 1e-9);
    // Then the 401(k) at the ordinary-income marginal rate (22%). The draw's
    // net is reduced by tax, so the remaining need is the shortfall created by
    // that tax (the engine draws `min(remaining, balance)`, not a tax gross-up).
    const k = res.draws[1];
    expect(k.instrumentType).toBe("EMPLOYER_DISCRETIONARY_LOCKED");
    expectClose(k.draw, 5000, 1e-9);
    const expectedTax = 5000 * (US_2025.incomeTax.marginalRateAtRetirement ?? 0.22);
    expectClose(k.tax, expectedTax, 1e-6);
    expectClose(res.unmetNeed, expectedTax, 1e-6);
  });

  it("taxes CD growth annually so exit from a CD sleeve is tax-free", () => {
    const sleeves = {
      LIQUID_CASH: { balance: 0, unlocked: true },
      FIXED_TERM_DEPOSIT: { balance: 4000, unlocked: true },
      MARKET_LINKED_POOLED: { balance: 0, unlocked: true },
      MARKET_LINKED_DIRECT: { balance: 0, unlocked: true },
      GOV_SAFE_LOCKED: { balance: 0, unlocked: true },
      EMPLOYER_DISCRETIONARY_LOCKED: { balance: 0, unlocked: true },
    };
    const res = runWithdrawalWaterfall(4000, sleeves, US_2025);
    expect(res.unmetNeed).toBe(0);
    expect(res.draws[0].instrumentType).toBe("FIXED_TERM_DEPOSIT");
    expectClose(res.draws[0].tax, 0, 1e-9);
  });

  it("taxes long-term gains from a direct-stock sale at 15% with no annual exemption", () => {
    const lot = makeLot({
      id: "l1",
      ticker: "AAPL",
      quantity: 100,
      acquisitionDate: "2024-01-01", // held > 1 year by the 2025 sale
      acquisitionPricePerUnit: 100,
    });
    const res = disposeAcrossLots(
      { quantity: 100, pricePerUnit: 150, date: "2025-06-01" },
      [lot],
      "MARKET_LINKED_DIRECT",
      US_2025,
      "FIFO",
    );
    // gain = (150 − 100) × 100 = 5000; long-term @ 15%, no exemption.
    expectClose(res.gain, 5000, 1e-9);
    expectClose(res.tax, 5000 * 0.15, 1e-9);
  });

  it("taxes short-term gains at the ordinary-income marginal rate", () => {
    const lot = makeLot({
      id: "l2",
      ticker: "MSFT",
      quantity: 10,
      acquisitionDate: "2025-01-01", // held < 1 year by the 2025 sale
      acquisitionPricePerUnit: 200,
    });
    const res = disposeAcrossLots(
      { quantity: 10, pricePerUnit: 300, date: "2025-06-01" },
      [lot],
      "MARKET_LINKED_DIRECT",
      US_2025,
      "FIFO",
    );
    const gain = (300 - 200) * 10;
    const shortRate = US_2025.incomeTax.marginalRateAtRetirement ?? 0.22;
    expectClose(res.gain, gain, 1e-9);
    expectClose(res.tax, gain * shortRate, 1e-9);
  });

  it("computeGainsTax honours the 366-day long-term threshold", () => {
    const rule = US_2025.capitalGains!["MARKET_LINKED_DIRECT"];
    // 364 days → short-term; 366 days → long-term.
    const short = computeGainsTax(1000, 364, rule as never, US_2025);
    const long = computeGainsTax(1000, 366, rule as never, US_2025);
    const shortRate = US_2025.incomeTax.marginalRateAtRetirement ?? 0.22;
    expectClose(short, 1000 * shortRate, 1e-9);
    expectClose(long, 1000 * 0.15, 1e-9);
  });
});
