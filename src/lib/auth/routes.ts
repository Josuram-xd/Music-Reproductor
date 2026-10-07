export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
/** Home screen; `/` redirects here (next.config.ts). */
export const HOME_PATH = "/library";

/**
 * How the proxy treats a path:
 * - `guest`: only for signed-out users (signed-in users go home).
 * - `public`: anyone (auth callbacks).
 * - `api`: never redirected; route handlers answer 401 themselves.
 * - `protected`: everything else, i.e. the `(app)` routes.
 */
export type RouteAccess = "guest" | "public" | "api" | "protected";

const GUEST_PATHS = [LOGIN_PATH, REGISTER_PATH];
const PUBLIC_PREFIXES = ["/auth/"];

const matches = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

export function routeAccess(pathname: string): RouteAccess {
  if (GUEST_PATHS.some((path) => matches(pathname, path))) return "guest";
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return "public";
  if (matches(pathname, "/api")) return "api";
  return "protected";
}

/**
 * Sanitizes a `next` redirect target so it can only point inside the app
 * (blocks `https://evil.com`, `//evil.com`, `/\evil.com`…).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return HOME_PATH;
  }
  if (routeAccess(new URL(next, "http://x").pathname) === "guest") return HOME_PATH;
  return next;
}

/** `/login?next=…` for a protected path the user tried to open. */
export function loginUrlFor(pathname: string, search = ""): string {
  if ((pathname === "/" || pathname === HOME_PATH) && !search) return LOGIN_PATH;
  return `${LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}`;
}
