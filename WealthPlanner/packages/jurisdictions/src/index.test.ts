import { describe, expect, it } from "vitest";
import { JurisdictionPackSchema } from "./schema";

describe("jurisdictions schema smoke", () => {
  it("rejects a non-pack object", () => {
    expect(JurisdictionPackSchema.safeParse({ packId: 5 }).success).toBe(false);
  });
});
