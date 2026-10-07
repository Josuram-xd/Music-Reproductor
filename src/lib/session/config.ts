import { LAST_SEEN_COOKIE, parseGraceSeconds, signLastSeen } from "./grace";

/** Server-side session settings (not available in the browser). */
export function sessionConfig() {
  const secret = process.env.SESSION_COOKIE_SECRET;
  if (!secret) throw new Error("Missing SESSION_COOKIE_SECRET (see .env.example)");
  return { secret, graceSeconds: parseGraceSeconds(process.env.SESSION_GRACE_SECONDS) };
}

/** Cookie options for `pl_last_seen`: persistent, so it survives closing the browser. */
export const LAST_SEEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;

/** A fresh, signed `pl_last_seen` cookie for `userId`, ready for `cookies.set`. */
export async function lastSeenCookie(userId: string, now = Date.now()) {
  const { secret } = sessionConfig();
  return {
    name: LAST_SEEN_COOKIE,
    value: await signLastSeen(userId, now, secret),
    ...LAST_SEEN_COOKIE_OPTIONS,
  };
}
