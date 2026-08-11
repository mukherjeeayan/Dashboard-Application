import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptValue, decryptValue, loadOrCreateSecret } from "./secret";

describe("ai secret", () => {
  it("round-trips a value through encrypt/decrypt", () => {
    const secret = loadOrCreateSecret(join(mkdtempSync(join(tmpdir(), "wp-secret-")), "k"));
    const encrypted = encryptValue(secret, "sk-ant-abc123");
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();
    expect(encrypted.data).not.toContain("abc123");
    expect(decryptValue(secret, encrypted)).toBe("sk-ant-abc123");
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const secret = loadOrCreateSecret(join(mkdtempSync(join(tmpdir(), "wp-secret-")), "k"));
    const a = encryptValue(secret, "same");
    const b = encryptValue(secret, "same");
    expect(a.data).not.toBe(b.data);
  });

  it("fails to decrypt with the wrong secret", () => {
    const secret = loadOrCreateSecret(join(mkdtempSync(join(tmpdir(), "wp-secret-")), "k"));
    const other = loadOrCreateSecret(join(mkdtempSync(join(tmpdir(), "wp-secret-")), "k2"));
    const encrypted = encryptValue(secret, "value");
    expect(() => decryptValue(other, encrypted)).toThrow();
  });

  it("loads the same secret on repeated calls from one file", () => {
    const dir = mkdtempSync(join(tmpdir(), "wp-secret-"));
    const first = loadOrCreateSecret(join(dir, "k"));
    const second = loadOrCreateSecret(join(dir, "k"));
    expect(first).toBe(second);
  });

  it("respects an existing secret file", () => {
    const dir = mkdtempSync(join(tmpdir(), "wp-secret-"));
    const file = join(dir, "k");
    writeFileSync(file, "my-secret-material", "utf8");
    // sha-256 hex of the file contents
    expect(loadOrCreateSecret(file)).toMatch(/^[0-9a-f]{64}$/);
  });
});
