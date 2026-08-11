// AI key at-rest encryption (docs/16 §16.4). A per-install 256-bit secret is
// generated on first use and stored in the OS app-data directory alongside the
// DB file (never in the DB itself, so an export/backup of the DB can't leak
// it). Keys are encrypted with AES-256-GCM using Node's built-in `crypto` —
// no new dependency. The secret is never written to logs or error reports.

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ensureDbDir, resolveDbDir } from "../db/path";

const KEY_FILE = "ai-secret.key";

/** 12-byte GCM nonce, delivered alongside the ciphertext. */
export interface EncryptedValue {
  /** base64 iv (12 bytes) */
  iv: string;
  /** base64 auth tag (16 bytes) */
  tag: string;
  /** base64 ciphertext */
  data: string;
}

export function encryptValue(secretHex: string, plaintext: string): EncryptedValue {
  const iv = randomBytes(12);
  const key = Buffer.from(secretHex, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: data.toString("base64"),
  };
}

export function decryptValue(secretHex: string, value: EncryptedValue): string {
  const key = Buffer.from(secretHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.data, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Derives a stable 32-byte hex key from the per-install secret file. */
function secretHex(secretText: string): string {
  return createHash("sha256").update(secretText).digest("hex");
}

/** Returns (and lazily creates) the per-install secret, as its sha-256 hex. */
export function loadOrCreateSecret(secretPath?: string): string {
  const path = secretPath ?? resolveSecretPath();
  if (existsSync(path)) {
    return secretHex(readFileSync(path, "utf8").trim());
  }
  const secret = randomBytes(32).toString("hex");
  writeFileSync(path, secret, { encoding: "utf8", mode: 0o600 });
  return secretHex(secret);
}

function resolveSecretPath(): string {
  const dir = resolveDbDir();
  ensureDbDir();
  mkdirSync(dir, { recursive: true });
  return join(dir, KEY_FILE);
}
