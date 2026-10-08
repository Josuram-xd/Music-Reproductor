import { NextResponse } from "next/server";
import { apiError, authenticate } from "@/lib/auth/api";
import { spotifyAccessToken } from "@/lib/spotify/server";

/**
 * Short-lived access token for the Web Playback SDK (it needs one in the
 * browser). The refresh token stays on the server.
 */
export async function GET() {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);
  const result = await spotifyAccessToken(auth.supabase, auth.userId);
  if (!result.ok) return apiError(result.error, result.error === "failed" ? 502 : 409);
  return NextResponse.json(
    { accessToken: result.accessToken, expiresAt: result.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
