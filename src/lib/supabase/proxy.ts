import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookies for this request and returns the
 * signed-in user id (or `null`). `withSession` copies the refreshed cookies
 * and no-cache headers onto any other response (e.g. a redirect).
 */
export async function updateSession(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });
  const pending: { headers: Record<string, string> } = { headers: {} };

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        pending.headers = headers;
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it validates the
  // JWT and refreshes an expired session, writing new cookies via setAll.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  const withSession = (target: NextResponse) => {
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    for (const [name, value] of Object.entries(pending.headers)) target.headers.set(name, value);
    return target;
  };

  return { supabase, response, userId, withSession };
}
