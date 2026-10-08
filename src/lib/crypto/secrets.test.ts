// @vitest-environment node
import { randomBytes } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { decryptSecret, encryptSecret } from "./secrets";

vi.mock("server-only", () => ({}));

const key = randomBytes(32).toString("base64");
const otherKey = randomBytes(32).toString("base64");

describe("secrets", () => {
  test("round-trips a secret", () => {
    const sealed = encryptSecret("AIza-secret-key", key);
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain("AIza");
    expect(decryptSecret(sealed, key)).toBe("AIza-secret-key");
  });

  test("the same secret encrypts differently every time (random IV)", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  test("rejects another key, tampering and unknown formats", () => {
    const sealed = encryptSecret("secret", key);
    expect(() => decryptSecret(sealed, otherKey)).toThrow();
    const parts = sealed.split(".");
    parts[2] = Buffer.from("evil").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret("plain-text", key)).toThrow(/format/);
  });

  test("requires a 32-byte key", () => {
    expect(() => encryptSecret("x", undefined)).toThrow(/ENCRYPTION_KEY/);
    expect(() => encryptSecret("x", Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
