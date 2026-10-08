import { NextResponse } from "next/server";
import { apiError, authenticate, readJson } from "@/lib/auth/api";
import { type LibraryTrack, TRACK_COLUMNS, toPlayerTrack } from "@/lib/library/tracks";
import {
  EMPTY_SAVED_QUEUE,
  parseQueueStatePayload,
  toQueueStateRow,
  toSavedQueue,
} from "@/lib/player/queue-state";

const NO_STORE = { "Cache-Control": "no-store" };
/** Ids per `in.(…)` filter, so the PostgREST URL stays short. */
const ID_CHUNK = 200;

/** The signed-in user's saved queue, with the tracks that still exist. */
export async function GET() {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);
  const { supabase } = auth;

  const { data: row, error } = await supabase
    .from("queue_state")
    .select("track_ids, current_index, position_s")
    .maybeSingle();
  if (error) return apiError("load_failed", 500);
  if (!row || row.track_ids.length === 0) {
    return NextResponse.json(EMPTY_SAVED_QUEUE, { headers: NO_STORE });
  }

  const chunks: string[][] = [];
  for (let i = 0; i < row.track_ids.length; i += ID_CHUNK) {
    chunks.push(row.track_ids.slice(i, i + ID_CHUNK));
  }
  // RLS only returns the user's own tracks; deleted ones are simply missing.
  const results = await Promise.all(
    chunks.map((ids) =>
      supabase.from("tracks").select(TRACK_COLUMNS).in("id", ids).returns<LibraryTrack[]>(),
    ),
  );
  if (results.some((result) => result.error)) return apiError("load_failed", 500);
  const tracks = results.flatMap((result) => result.data ?? []).map(toPlayerTrack);

  return NextResponse.json(toSavedQueue(row, tracks), { headers: NO_STORE });
}

/** Saves the queue order, the loaded track and its position (one row per user). */
export async function PUT(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);
  const { supabase, userId } = auth;

  const payload = parseQueueStatePayload(await readJson(request));
  if (!payload) return apiError("invalid_request", 400);

  const { error } = await supabase
    .from("queue_state")
    .upsert(
      { owner_id: userId, ...toQueueStateRow(payload), updated_at: new Date().toISOString() },
      { onConflict: "owner_id" },
    );
  if (error) return apiError("save_failed", 500);
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
