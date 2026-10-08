import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/api";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { getProfile } from "@/lib/spotify/api";
import type { SpotifyConnectStatus } from "@/lib/spotify/config";
import { exchangeCode, SpotifyAuthError } from "@/lib/spotify/oauth";
import { OAUTH_COOKIE, openOAuthPending } from "@/lib/spotify/oauth-cookie";
import { saveTokens } from "@/lib/spotify/server";

/**
 * Spotify sends the user back here with `code` + `state`. Checks the state,
 * trades the code (with the PKCE verifier) for tokens, stores them
 * encrypted and returns to Ajustes with `?spotify=<status>`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (status: SpotifyConnectStatus) => {
    const response = NextResponse.redirect(new URL(`/settings?spotify=${status}`, url.origin));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/spotify" });
    return response;
  };

  const auth = await authenticate();
  if (!auth) return NextResponse.redirect(new URL(LOGIN_PATH, url.origin));

  const pending = openOAuthPending((await cookies()).get(OAUTH_COOKIE)?.value);
  const state = url.searchParams.get("state");
  if (!pending || !state || state !== pending.state) return back("state_mismatch");
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("failed");

  try {
    const tokens = await exchangeCode({
      code,
      redirectUri: pending.redirectUri,
      clientId: pending.clientId,
      codeVerifier: pending.verifier,
    });
    // Premium or not decides whether the browser can play; unknown is fine too.
    const profile = await getProfile(tokens.accessToken).catch(() => undefined);
    const saved = await saveTokens(auth.supabase, auth.userId, tokens, { profile });
    return back(saved ? "connected" : "failed");
  } catch (error) {
    const reason = error instanceof SpotifyAuthError ? error.reason : "failed";
    return back(reason === "invalid_client" ? "invalid_client" : "failed");
  }
}
