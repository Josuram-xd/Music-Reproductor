import { NextResponse } from "next/server";
import { apiError, authenticate } from "@/lib/auth/api";
import { searchYouTube } from "@/lib/youtube/search";
import { youtubeSearchDeps } from "@/lib/youtube/server";

const STATUS = { invalid_query: 400, no_key: 503, quota_exhausted: 429, failed: 502 } as const;

/**
 * `GET /api/youtube/search?q=…`: searches YouTube without exposing any key.
 * Cached results first, then the user's own key, then the shared one.
 */
export async function GET(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);

  const query = new URL(request.url).searchParams.get("q");
  const result = await searchYouTube(query, youtubeSearchDeps(auth.supabase));
  if (!result.ok) return apiError(result.error, STATUS[result.error]);
  return NextResponse.json(result.response, { headers: { "Cache-Control": "no-store" } });
}
