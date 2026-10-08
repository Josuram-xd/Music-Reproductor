import { NextResponse } from "next/server";
import { apiError, authenticate, readJson } from "@/lib/auth/api";
import { parsePlayEvent } from "@/lib/radio/play-tracker";

/**
 * `POST /api/play-events`: records one play (listened time, completed,
 * skipped). Sent with `keepalive`, so it also works when the tab closes.
 */
export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);

  const event = parsePlayEvent(await readJson(request));
  if (!event) return apiError("invalid_request", 400);

  const row = {
    source: event.source,
    external_id: event.externalId,
    title: event.title,
    artist: event.artist,
    started_at: event.startedAt,
    listened_s: event.listenedS,
    completed: event.completed,
    skipped: event.skipped,
    from_radio: event.fromRadio,
  };
  let { error } = await auth.supabase
    .from("play_events")
    .insert({ ...row, track_id: event.trackId });
  // The library track may be gone (or not theirs): keep the play without the link.
  if (error?.code === "23503") {
    ({ error } = await auth.supabase.from("play_events").insert(row));
  }
  if (error) return apiError("save_failed", 500);
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
