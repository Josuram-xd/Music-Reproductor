import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/api";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { SPOTIFY_CALLBACK_PATH } from "@/lib/spotify/config";
import { authorizeUrl } from "@/lib/spotify/oauth";
import { OAUTH_COOKIE, oauthCookieOptions, sealOAuthPending } from "@/lib/spotify/oauth-cookie";
import { codeChallenge, randomToken } from "@/lib/spotify/pkce";
import { resolveClientId } from "@/lib/spotify/server";

/**
 * Starts "Conectar con Spotify": Authorization Code + PKCE (no client
 * secret). The verifier and `state` travel in an encrypted httpOnly cookie.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const auth = await authenticate();
  if (!auth) return NextResponse.redirect(new URL(LOGIN_PATH, origin));

  const clientId = await resolveClientId(auth.supabase);
  if (!clientId) return NextResponse.redirect(new URL("/settings?spotify=no_client_id", origin));

  const state = randomToken(24);
  const verifier = randomToken();
  const redirectUri = `${origin}${SPOTIFY_CALLBACK_PATH}`;

  let sealed: string;
  try {
    sealed = sealOAuthPending({ state, verifier, clientId, redirectUri });
  } catch {
    // ENCRYPTION_KEY missing: the tokens could not be stored either.
    return NextResponse.redirect(new URL("/settings?spotify=failed", origin));
  }

  const response = NextResponse.redirect(
    authorizeUrl({ clientId, redirectUri, state, codeChallenge: codeChallenge(verifier) }),
  );
  response.cookies.set(OAUTH_COOKIE, sealed, oauthCookieOptions);
  return response;
}
