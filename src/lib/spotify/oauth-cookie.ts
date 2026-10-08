import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";

/** Short-lived cookie that carries the PKCE verifier and `state` across the redirect. */
export const OAUTH_COOKIE = "pl_spotify_oauth";
export const OAUTH_COOKIE_MAX_AGE_S = 10 * 60;

export interface OAuthPending {
  state: string;
  verifier: string;
  clientId: string;
  redirectUri: string;
}

/** Encrypted (and so tamper-proof): the verifier must stay secret until the callback. */
export function sealOAuthPending(pending: OAuthPending): string {
  return encryptSecret(JSON.stringify(pending));
}

export function openOAuthPending(value: string | undefined): OAuthPending | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decryptSecret(value)) as Partial<OAuthPending>;
    return typeof parsed.state === "string" &&
      typeof parsed.verifier === "string" &&
      typeof parsed.clientId === "string" &&
      typeof parsed.redirectUri === "string"
      ? (parsed as OAuthPending)
      : null;
  } catch {
    return null;
  }
}

export const oauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/spotify",
  maxAge: OAUTH_COOKIE_MAX_AGE_S,
};
