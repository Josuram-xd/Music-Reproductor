import { NextResponse } from "next/server";
import { apiError, authenticate, readJson } from "@/lib/auth/api";
import { artistKey } from "@/lib/radio/signals";

/** Each "No me gusta" lowers the artist this much (−3 or less = never recommended). */
const DISLIKE_STEP = -1;
const MIN_SCORE = -10;

/** `POST /api/radio/feedback` `{ artist }`: "No me gusta" on a recommendation. */
export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);

  const body = await readJson(request);
  const artist = artistKey(typeof body?.artist === "string" ? body.artist : null);
  if (!artist || artist.length > 300) return apiError("invalid_request", 400);

  const { data: current } = await auth.supabase
    .from("radio_feedback")
    .select("score")
    .eq("artist", artist)
    .maybeSingle();
  const { error } = await auth.supabase.from("radio_feedback").upsert(
    {
      owner_id: auth.userId,
      artist,
      score: Math.max(MIN_SCORE, (current?.score ?? 0) + DISLIKE_STEP),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,artist" },
  );
  if (error) return apiError("save_failed", 500);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
