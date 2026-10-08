import { NextResponse } from "next/server";
import { apiError, authenticate } from "@/lib/auth/api";
import { SpotifyApiError, searchTracks } from "@/lib/spotify/api";
import { spotifyAccessToken } from "@/lib/spotify/server";
import { normalizeQuery } from "@/lib/youtube/search";

/** `GET /api/spotify/search?q=…`: tracks from the user's connected Spotify account. */
export async function GET(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);

  const raw = new URL(request.url).searchParams.get("q");
  if (!normalizeQuery(raw)) return apiError("invalid_query", 400);

  const token = await spotifyAccessToken(auth.supabase, auth.userId);
  if (!token.ok) return apiError(token.error, token.error === "failed" ? 502 : 409);

  try {
    const results = await searchTracks(raw!.trim(), token.accessToken);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof SpotifyApiError ? error.status : 0;
    if (status === 429) return apiError("rate_limited", 429);
    if (status === 401) return apiError("reauth", 409);
    // Development-mode apps only answer users added in "User Management".
    if (status === 403) return apiError("forbidden", 403);
    return apiError("failed", 502);
  }
}
