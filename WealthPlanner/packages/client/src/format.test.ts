import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  formatSignedPercent,
} from "./format";

describe("format", () => {
  it("formats money with locale-aware digit grouping", () => {
    // en-IN groups in lakh/crore.
    expect(formatMoney(12345678, "INR", "en-IN")).toBe("₹1,23,45,678");
    // en-US uses standard thousands grouping.
    expect(formatMoney(12345678, "USD", "en-US")).toBe("$12,345,678");
  });

  it("returns an em dash for null/undefined money", () => {
    expect(formatMoney(null, "INR")).toBe("—");
    expect(formatMoney(undefined, "INR")).toBe("—");
  });

  it("defaults to the en-IN locale when none is supplied", () => {
    expect(formatMoney(100000, "INR")).toBe("₹1,00,000");
  });

  it("formats compact money with locale grouping", () => {
    // Compact notation rounds to the ICU short-format unit for each locale.
    expect(formatMoneyCompact(25000000, "INR", "en-IN")).toBe("₹3Cr");
    expect(formatMoneyCompact(12000000, "USD", "en-US")).toBe("$12M");
    expect(formatMoneyCompact(null, "INR")).toBe("—");
  });

  it("formats plain and signed percentages", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
    expect(formatSignedPercent(0.05)).toBe("+5.0%");
    expect(formatSignedPercent(-0.05)).toBe("-5.0%");
  });

  it("formats a bare number with locale grouping", () => {
    expect(formatNumber(1234567, "en-IN")).toBe("12,34,567");
    expect(formatNumber(null)).toBe("—");
  });
});
