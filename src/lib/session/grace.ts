/**
 * Session grace window. The `pl_last_seen` cookie holds the last time the app
 * was seen alive, signed with HMAC-SHA256 and bound to the user id:
 * `<timestampMs>.<base64url signature of "userId.timestampMs">`.
 * Pure Web Crypto, so it runs in the proxy, route handlers and tests.
 */

export const LAST_SEEN_COOKIE = "pl_last_seen";
export const DEFAULT_GRACE_SECONDS = 300;
export const HEARTBEAT_INTERVAL_MS = 30_000;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Constant-time string comparison (avoids leaking how many chars matched). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signLastSeen(userId: string, timestamp: number, secret: string) {
  return `${timestamp}.${await hmac(secret, `${userId}.${timestamp}`)}`;
}

/** Timestamp in the cookie, or `null` if missing, malformed, forged or from another user. */
export async function verifyLastSeen(
  value: string | undefined,
  userId: string,
  secret: string,
): Promise<number | null> {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const raw = value.slice(0, dot);
  if (!/^\d+$/.test(raw)) return null;
  const timestamp = Number(raw);
  const expected = await hmac(secret, `${userId}.${timestamp}`);
  return safeEqual(value.slice(dot + 1), expected) ? timestamp : null;
}

/** Seconds left in the grace window (never negative). */
export function graceRemaining(lastSeenMs: number, nowMs: number, graceSeconds: number): number {
  return Math.max(0, Math.ceil(graceSeconds - (nowMs - lastSeenMs) / 1000));
}

export function isGraceExpired(lastSeenMs: number, nowMs: number, graceSeconds: number): boolean {
  return nowMs - lastSeenMs > graceSeconds * 1000;
}

/** "4:32" style countdown. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Parses SESSION_GRACE_SECONDS, falling back to the default on bad input. */
export function parseGraceSeconds(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_GRACE_SECONDS;
}
