import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Random string for PKCE verifiers and the OAuth `state` (base64url, 64 chars). */
export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

/** S256 code challenge: base64url(sha256(verifier)). */
export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
