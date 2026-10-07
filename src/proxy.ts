import { type NextRequest, NextResponse } from "next/server";
import { HOME_PATH, LOGIN_PATH, loginUrlFor, routeAccess } from "@/lib/auth/routes";
import { lastSeenCookie, sessionConfig } from "@/lib/session/config";
import { isGraceExpired, LAST_SEEN_COOKIE, verifyLastSeen } from "@/lib/session/grace";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Optimistic auth gate: refreshes the Supabase session, enforces the session
 * grace window and redirects by route type. Pages and actions still verify
 * the user (see lib/auth/dal.ts).
 */
export async function proxy(request: NextRequest) {
  const { supabase, response, userId, withSession } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const access = routeAccess(pathname);

  if (!userId) {
    if (access === "protected") {
      return withSession(
        NextResponse.redirect(new URL(loginUrlFor(pathname, search), request.url)),
      );
    }
    return response;
  }

  // Auth callbacks run mid sign-in and set the cookie themselves.
  if (access === "public") return response;

  // Grace window: no (valid) heartbeat for longer than the grace → log out.
  const { secret, graceSeconds } = sessionConfig();
  const lastSeen = await verifyLastSeen(
    request.cookies.get(LAST_SEEN_COOKIE)?.value,
    userId,
    secret,
  );
  if (lastSeen === null || isGraceExpired(lastSeen, Date.now(), graceSeconds)) {
    await supabase.auth.signOut({ scope: "local" });
    const expired =
      access === "api"
        ? NextResponse.json({ error: "session_expired" }, { status: 401 })
        : NextResponse.redirect(new URL(`${LOGIN_PATH}?reason=expired`, request.url));
    const result = withSession(expired);
    result.cookies.delete(LAST_SEEN_COOKIE);
    return result;
  }

  const result =
    access === "guest"
      ? withSession(NextResponse.redirect(new URL(HOME_PATH, request.url)))
      : response;
  // Any request is a sign of life: slide the window forward.
  result.cookies.set(await lastSeenCookie(userId));
  return result;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|m4a|ogg|wav)$).*)",
  ],
};
