import { NextResponse } from "next/server";
import { apiError, authenticate } from "@/lib/auth/api";
import { recordSearch } from "@/lib/radio/server";
import { SpotifyApiError, searchTracks } from "@/lib/spotify/api";
import { spotifyApiErrorCode } from "@/lib/spotify/messages";
import { spotifyAccessToken } from "@/lib/spotify/server";
import { normalizeQuery } from "@/lib/youtube/search";

/** `GET /api/spotify/search?q=…`: tracks from the user's connected Spotify account. */
export async function GET(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);

  const raw = new URL(request.url).searchParams.get("q");
  if (!normalizeQuery(raw)) return apiError("invalid_query", 400);

  let token: Awaited<ReturnType<typeof spotifyAccessToken>>;
  try {
    token = await spotifyAccessToken(auth.supabase, auth.userId);
  } catch (error) {
    console.error("[spotify-search] Failed to load the account token", error);
    return apiError("spotify_connection_failed", 502);
  }
  if (!token.ok) {
    return apiError(
      token.error === "failed" ? "spotify_token_failed" : token.error,
      token.error === "failed" ? 502 : 409,
    );
  }

  try {
    const results = await searchTracks(raw!.trim(), token.accessToken);
    // Recent searches are a neko radio signal.
    await recordSearch(auth.supabase, raw!, "spotify");
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof SpotifyApiError ? error.status : 0;
    if (status === 429) return apiError("rate_limited", 429);
    if (status === 401) return apiError("reauth", 409);
    // Development-mode apps only answer users added in "User Management".
    if (status === 403) return apiError("forbidden", 403);
    console.error("[spotify-search] Spotify API rejected the request", {
      status,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: spotifyApiErrorCode(status) },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
