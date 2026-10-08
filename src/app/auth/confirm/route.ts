import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { lastSeenCookie } from "@/lib/session/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth landing for email confirmation and OAuth (Google). Supports:
 * - `?token_hash=…&type=…` (custom email template, works on any device)
 * - `?code=…` (PKCE: default email link and OAuth, same browser)
 * - `?error=…` (OAuth cancelled or failed)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  const supabase = await createClient();
  let userId: string | undefined;
  if (tokenHash && type) {
    const { data } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    userId = data.user?.id;
  } else if (code) {
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    userId = data.user?.id;
  }

  if (!userId) {
    const oauth = params.get("flow") === "oauth" || params.has("error");
    const reason =
      params.get("flow") === "recovery"
        ? "recovery-failed"
        : oauth
          ? "oauth-failed"
          : "confirm-failed";
    return NextResponse.redirect(new URL(`${LOGIN_PATH}?reason=${reason}`, request.url));
  }

  const recovery = params.get("flow") === "recovery";
  const destination = recovery
    ? `/reset-password?next=${encodeURIComponent(safeNextPath(params.get("next")))}`
    : safeNextPath(params.get("next"));
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(await lastSeenCookie(userId));
  return response;
}
