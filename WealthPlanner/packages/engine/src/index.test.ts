import { describe, expect, it } from "vitest";
import { INSTRUMENT_TYPES } from "./types";

describe("engine domain types", () => {
  it("exposes all nine abstract instrument types", () => {
    expect(INSTRUMENT_TYPES).toHaveLength(9);
    expect(INSTRUMENT_TYPES).toContain("MARKET_LINKED_POOLED");
    expect(INSTRUMENT_TYPES).toContain("DIGITAL_ASSET");
  });
});
