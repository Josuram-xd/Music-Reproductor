import { type NextRequest, NextResponse } from "next/server";
import { HOME_PATH, loginUrlFor, routeAccess } from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Optimistic auth gate: refreshes the Supabase session and redirects by
 * route type. Pages and actions still verify the user (see lib/auth/dal.ts).
 */
export async function proxy(request: NextRequest) {
  const { response, isSignedIn, withSession } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const access = routeAccess(pathname);

  if (access === "protected" && !isSignedIn) {
    return withSession(NextResponse.redirect(new URL(loginUrlFor(pathname, search), request.url)));
  }
  if (access === "guest" && isSignedIn) {
    return withSession(NextResponse.redirect(new URL(HOME_PATH, request.url)));
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|m4a|ogg|wav)$).*)",
  ],
};
