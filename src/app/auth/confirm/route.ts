import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation landing. Supports both link styles:
 * - `?token_hash=…&type=…` (custom email template, works on any device)
 * - `?code=…` (default PKCE link, same browser that signed up)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  const supabase = await createClient();
  let confirmed = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    confirmed = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    confirmed = !error;
  }

  const target = confirmed
    ? safeNextPath(params.get("next"))
    : `${LOGIN_PATH}?reason=confirm-failed`;
  return NextResponse.redirect(new URL(target, request.url));
}
