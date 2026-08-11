import { describe, expect, it } from "vitest";
import { projectLockedSafe } from "./instruments/lockedSafe";
import {
  projectEmployerMandatoryLocked,
  type PFConfig,
} from "./instruments/employerMandatory";
import { growingAnnuity } from "./closedForm/growingAnnuity";
import { deriveTargetYear } from "./goals/goals";
import { amortize } from "./liabilities";
import {
  sequenceRisk,
  guardrailWithdrawal,
  allocationRisk,
} from "./risk/risk";
import { runWithdrawalWaterfall, runPooledDraw } from "./projection/withdrawalWaterfall";
import { buildGlidePath } from "./projection/glidePath";
import { generateDeadlines, ruleConsistency, buildActionItems } from "./automation/automation";
import { assessInsurance } from "./insurance";
import { assessEmergencyFund } from "./emergencyFund";
import { loadPack } from "@wealthpath/jurisdictions";

const IN_2025 = loadPack("IN-2025");

// Helper: assert numeric closeness with the documented tolerance convention
// (exact for pure arithmetic; relative 1e-6 for closed forms).
function expectClose(actual: number, expected: number, relTol = 1e-6): void {
  const scale = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(relTol * scale);
}

describe("golden: PPF compounding (docs/15 §15.3.1)", () => {
  it("reproduces the workbook's year-on-year balances", () => {
    // fixture: docs/15-reference-data-and-worked-examples.md §15.3.1
    const curve = projectLockedSafe({
      openingBalance: 1_060_038,
      contribution: 150_000,
      rate: 0.071,
      years: 2,
    });
    expectClose(curve[0], 1_285_300.698, 1e-6);
    expectClose(curve[1], 1_526_557.371, 1e-6);
  });
});

describe("golden: EPF/PF composed contribution with cap (docs/15 §15.3.2)", () => {
  const config: PFConfig = {
    monthlyBasicSalary: 53_700,
    employeeRate: 0.12,
    employerRate: 0.12,
    employerDiversionCapPerMonth: 1_250,
    voluntaryRate: 0.28,
    salaryGrowthRate: 0.02,
    annualTaxFreeThreshold: 250_000,
    declaredRate: 0.0825,
  };

  it("reproduces year 1 (pre-cap) components and closing balance", () => {
    // fixture: docs/15-reference-data-and-worked-examples.md §15.3.2
    const year = projectEmployerMandatoryLocked(config, 1_386_150, 1)[0];
    expectClose(year.employee, 77_328, 1e-6);
    expectClose(year.employer, 62_328, 1e-6);
    expectClose(year.voluntary, 180_432, 1e-6);
    expectClose(year.total, 320_088, 1e-6);
    expectClose(year.closingBalance, 1_820_595.375, 1e-6);
  });

  it("reproduces the post-cap year (voluntary as plug)", () => {
    // fixture: docs/15-reference-data-and-worked-examples.md §15.3.2 (year 2026)
    // After the threshold binds, total is capped and voluntary is the plug.
    const r2024 = projectEmployerMandatoryLocked(config, 1_386_150, 1)[0];
    const r2025 = projectEmployerMandatoryLocked(config, r2024.closingBalance, 2)[1];
    const r2026 = projectEmployerMandatoryLocked(config, r2025.closingBalance, 3)[2];
    // Employee grows with salary: 2026 employee = 80,452.0512
    expectClose(r2026.employee, 80_452.0512, 1e-6);
    expectClose(r2026.employer, 65_452.0512, 1e-6);
    expectClose(r2026.total, 250_000, 1e-6); // capped
    expectClose(r2026.voluntary, 104_095.8976, 1e-6); // plug
  });
});

describe("golden: goal target-date derivation (docs/15 §15.3.4)", () => {
  it("computes years-to-goal and target year from a beneficiary's age", () => {
    // fixture: docs/15-reference-data-and-worked-examples.md §15.3.4
    const currentAge = 1;
    const targetAge = 18;
    const currentYear = 2026;
    const yearsToGoal = targetAge - currentAge;
    expect(yearsToGoal).toBe(17);
    expect(deriveTargetYear(currentYear, currentAge, targetAge)).toBe(2043);
  });
});

describe("closed-form growing annuity (docs/06 §6.4)", () => {
  it("computes forward value and handles the r≈g limiting form", () => {
    // A 100k/yr expense growing at 5% outpaces a 7% return on a 1M sleeve, so
    // the corpus is depleted — the closed form legitimately returns a negative
    // FV (decumulation). What must hold is that it is finite and deterministic.
    const fv = growingAnnuity({ sleeve: 1_000_000, r: 0.07, n: 20, expense: 100_000, g: 0.05, splitWeight: 1 });
    expect(Number.isFinite(fv)).toBe(true);
    expect(fv).toBeLessThan(0);

    // With a modest expense the same sleeve accumulates to a positive FV.
    const positive = growingAnnuity({ sleeve: 1_000_000, r: 0.07, n: 20, expense: 10_000, g: 0.05, splitWeight: 1 });
    expect(positive).toBeGreaterThan(0);

    // r == g exactly must not divide by zero.
    const limit = growingAnnuity({ sleeve: 1_000_000, r: 0.07, n: 20, expense: 100_000, g: 0.07, splitWeight: 1 });
    expect(Number.isFinite(limit)).toBe(true);
  });
});

describe("liabilities (docs/06 §6.8)", () => {
  it("fully amortizes a loan to zero", () => {
    const rows = amortize({ principal: 1_000_000, annualRate: 0.09, tenureMonths: 120 });
    expect(rows).toHaveLength(120);
    expect(rows[rows.length - 1].remainingBalance).toBeLessThan(0.01);
  });
});

describe("risk tools (docs/06 §6.5)", () => {
  it("computes sequence risk as the forward/reversed gap", () => {
    // With no contributions, multiplication commutes so forward and reversed
    // terminal values are identical (gap is always ~0). Order only matters once
    // cash flows are added, so feed a nonzero contribution and assert the gap
    // is non-trivial (order-sensitive).
    const r = sequenceRisk([0.30, -0.10, 0.30, -0.10], 100, 10);
    expect(Math.abs(r.gap)).toBeGreaterThan(0);
    expect(Number.isFinite(r.gap)).toBe(true);
  });

  it("applies the guardrail rule", () => {
    // A withdrawal 30% above the prior triggers a cut to prior*(1+cutPct).
    const high = guardrailWithdrawal(1000, 0.05, 38.5, { upperMultiple: 1.2, lowerMultiple: 0.8, cutPct: 0.1 });
    expect(high.adjusted).toBe(true);
    expectClose(high.withdrawal, 38.5 * 1.1, 1e-9);
  });

  it("computes HHI and rebalancing actions", () => {
    const risk = allocationRisk({
      target: { EQUITY: 0.7, DEBT: 0.2, GOLD: 0.1 },
      current: { EQUITY: 100, DEBT: 0, GOLD: 0 },
      covariances: { EQUITY_EQUITY: 0.04 },
    });
    expect(risk.hhi).toBeCloseTo(1, 3); // fully concentrated in one bucket
    const eq = risk.rebalance.find((r) => r.bucket === "EQUITY");
    expectClose(eq!.amount, 0.7 * 100 - 100, 1e-9); // -30 → sell 30
  });
});

describe("withdrawal waterfall (docs/05 §5.4)", () => {
  it("draws in the jurisdiction's order and stops at the need", () => {
    const sleeves = {
      LIQUID_CASH: { balance: 1000, unlocked: true },
      FIXED_TERM_DEPOSIT: { balance: 0, unlocked: true },
      MARKET_LINKED_POOLED: { balance: 5000, unlocked: true },
      GOV_SAFE_LOCKED: { balance: 9000, unlocked: true },
      MARKET_LINKED_MULTI_SLEEVE: { balance: 0, unlocked: true },
    };
    const res = runWithdrawalWaterfall(3000, sleeves, IN_2025);
    expect(res.unmetNeed).toBe(0);
    // First draw should be from LIQUID_CASH (1000) then MF.
    expect(res.draws[0].instrumentType).toBe("LIQUID_CASH");
    expectClose(res.draws[0].draw, 1000, 1e-9);
  });

  it("returns unmetNeed when sleeves are insufficient", () => {
    const sleeves = {
      LIQUID_CASH: { balance: 100, unlocked: true },
      FIXED_TERM_DEPOSIT: { balance: 0, unlocked: true },
      MARKET_LINKED_POOLED: { balance: 0, unlocked: true },
      GOV_SAFE_LOCKED: { balance: 0, unlocked: true },
      MARKET_LINKED_MULTI_SLEEVE: { balance: 0, unlocked: true },
    };
    const res = runWithdrawalWaterfall(500, sleeves, IN_2025);
    expect(res.unmetNeed).toBeGreaterThan(0);
  });

  it("pooled draw is the fallback when the waterfall is disabled", () => {
    const sleeves = {
      LIQUID_CASH: { balance: 1000, unlocked: true },
      FIXED_TERM_DEPOSIT: { balance: 1000, unlocked: true },
      MARKET_LINKED_POOLED: { balance: 0, unlocked: true },
      GOV_SAFE_LOCKED: { balance: 0, unlocked: true },
      MARKET_LINKED_MULTI_SLEEVE: { balance: 0, unlocked: true },
    };
    const res = runPooledDraw(1000, sleeves, IN_2025);
    expect(res.unmetNeed).toBe(0);
  });

  it("supports a jurisdiction with no locked sleeve concept", () => {
    // Synthetic pack with an order that has no locked sleeves.
    const simplePack = {
      ...IN_2025,
      withdrawalWaterfall: { ...IN_2025.withdrawalWaterfall, order: ["LIQUID_CASH"] },
      instrumentRules: {
        CASH: {
          instrumentType: "LIQUID_CASH",
          displayLabel: "Cash",
          // Growth taxed at accrual (like a savings account), so exit is 0-tax.
          taxTreatment: { onGrowth: "SLAB_RATE_ANNUAL_ACCRUAL" },
        },
      },
    };
    const sleeves = {
      LIQUID_CASH: { balance: 1000, unlocked: true },
      FIXED_TERM_DEPOSIT: { balance: 0, unlocked: true },
      MARKET_LINKED_POOLED: { balance: 0, unlocked: true },
      GOV_SAFE_LOCKED: { balance: 0, unlocked: true },
      MARKET_LINKED_MULTI_SLEEVE: { balance: 0, unlocked: true },
    };
    const res = runWithdrawalWaterfall(500, sleeves, simplePack);
    expect(res.unmetNeed).toBe(0);
    expect(res.draws).toHaveLength(1);
    expect(res.draws[0].instrumentType).toBe("LIQUID_CASH");
  });
});

describe("glide path (docs/06 §6.3)", () => {
  it("declines equity toward the floor and holds gold constant", () => {
    const w = buildGlidePath(
      { startingEquityPct: 0.7, equityGlideDownStepPpPerYear: 0.02, equityFloorPct: 0.15, goldPctHeldConstant: 0.09, debtShareOfReleasedEquity: 0.85 },
      30,
    );
    expect(w[0].EQUITY).toBeCloseTo(0.7, 9);
    expect(w[29].EQUITY).toBeCloseTo(0.15, 9);
    for (const y of w) {
      expectClose(y.EQUITY + y.GOLD + y.DEBT + y.CASH, 1, 1e-9);
      expectClose(y.GOLD, 0.09, 1e-9);
    }
  });
});

describe("automation (docs/06 §6.8)", () => {
  it("generates deadlines per record and sorts by date", () => {
    const deadlines = generateDeadlines({
      accounts: [{ label: "PPF", kind: "LOCKED_EXTENSION", date: "2034-04-01" }],
      loans: [{ label: "Home", payoffDate: "2040-01-01" }],
      insurance: [{ label: "Term", renewalDate: "2027-05-01" }],
    });
    expect(deadlines).toHaveLength(3);
    // Sorted ascending by date: insurance (2027) < PPF (2034) < loan (2040).
    expect(deadlines[0].kind).toBe("INSURANCE_RENEWAL");
    expect(deadlines[2].kind).toBe("LOAN_PAYOFF");
  });

  it("flags rule-derived mismatches as CHECK", () => {
    const checks = ruleConsistency([
      { label: "PPF maturity", derived: 2034, used: 2049 },
      { label: "OK check", derived: 2034, used: 2034 },
    ]);
    expect(checks[0].status).toBe("CHECK");
    expect(checks[1].status).toBe("OK");
  });

  it("aggregates action items by severity and de-duplicates", () => {
    const items = buildActionItems([
      [{ id: "1", message: "Critical", severity: "CRITICAL", source: "risk" }],
      [{ id: "2", message: "Warn", severity: "WARN", source: "deadlines" }],
      [{ id: "3", message: "Critical", severity: "CRITICAL", source: "risk" }],
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].severity).toBe("CRITICAL");
  });
});

describe("insurance & emergency fund (docs/06 §6.8)", () => {
  it("sums actual policy cover instead of a single formula", () => {
    const res = assessInsurance({
      annualIncome: 1_000_000,
      familySize: 4,
      defaults: { incomeReplacementYearsTermLife: 6, healthBaseCoverPerPerson: 200_000, elderlyHealthCoverMultiplier: 10 },
      policies: [
        { type: "TERM", coverInForce: 3_000_000 },
        { type: "TERM", coverInForce: 2_000_000 },
      ],
    });
    expect(res.currentCoverInForce).toBe(5_000_000); // sum of policies, not a formula
  });

  it("tracks emergency-fund purchasing power", () => {
    const res = assessEmergencyFund({
      targetCoverageMonths: 12,
      monthlyExpense: 50_000,
      liquidBalance: 600_000,
      inflationRate: 0.08,
      years: 10,
    });
    expect(res.targetAmount).toBe(600_000);
    expect(res.realValueAtEnd).toBeLessThan(600_000); // eroded by inflation
  });
});
