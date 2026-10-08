import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for user secrets stored in Postgres (third-party API keys,
 * refresh tokens). The key is `ENCRYPTION_KEY` (32 bytes, base64) and never
 * leaves the server. Format: `v1.<iv>.<ciphertext>.<tag>` (base64url parts).
 */

const VERSION = "v1";
const IV_BYTES = 12;

function keyFrom(base64: string | undefined): Buffer {
  const key = base64 ? Buffer.from(base64, "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes in base64 (see .env.example)");
  }
  return key;
}

export function encryptSecret(plain: string, base64Key = process.env.ENCRYPTION_KEY): string {
  const key = keyFrom(base64Key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, data, cipher.getAuthTag()]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

/** Throws if the value was tampered with or encrypted with another key. */
export function decryptSecret(sealed: string, base64Key = process.env.ENCRYPTION_KEY): string {
  const key = keyFrom(base64Key);
  const [version, iv, data, tag, ...rest] = sealed.split(".");
  if (version !== VERSION || !iv || !data || !tag || rest.length > 0) {
    throw new Error("Unknown secret format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
