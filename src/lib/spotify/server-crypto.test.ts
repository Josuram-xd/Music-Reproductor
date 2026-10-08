// @vitest-environment node
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { openOAuthPending, sealOAuthPending } from "./oauth-cookie";
import { codeChallenge, randomToken } from "./pkce";

vi.mock("server-only", () => ({}));

const previousKey = process.env.ENCRYPTION_KEY;
beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterAll(() => {
  process.env.ENCRYPTION_KEY = previousKey;
});

describe("PKCE", () => {
  test("random tokens are long, url-safe and different", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(randomToken()).not.toBe(a);
  });

  test("the challenge is base64url(sha256(verifier))", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(codeChallenge(verifier)).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(codeChallenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("OAuth cookie", () => {
  const pending = { state: "s", verifier: "v", clientId: "c", redirectUri: "r" };

  test("round-trips without showing the verifier", () => {
    const sealed = sealOAuthPending(pending);
    expect(sealed).not.toContain("verifier");
    expect(openOAuthPending(sealed)).toEqual(pending);
  });

  test("missing or tampered cookies are rejected", () => {
    expect(openOAuthPending(undefined)).toBeNull();
    expect(openOAuthPending("v1.nope.nope.nope")).toBeNull();
    const sealed = sealOAuthPending(pending);
    expect(openOAuthPending(`${sealed}x`)).toBeNull();
  });
});
