import { describe, expect, it } from "vitest";
import { hashSnapshot } from "./hash";

describe("monteCarlo/hash", () => {
  it("is deterministic for equal input", () => {
    const a = { x: 1, y: { z: [1, 2, 3] }, seed: 12345 };
    expect(hashSnapshot(a)).toBe(hashSnapshot(a));
  });

  it("is invariant to property insertion order", () => {
    expect(hashSnapshot({ a: 1, b: 2 })).toBe(hashSnapshot({ b: 2, a: 1 }));
  });

  it("distinguishes different inputs", () => {
    expect(hashSnapshot({ trialCount: 1000 })).not.toBe(hashSnapshot({ trialCount: 5000 }));
  });
});
