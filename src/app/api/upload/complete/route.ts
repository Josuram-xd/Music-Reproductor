import { NextResponse } from "next/server";
import { apiError, authenticate, readJson } from "@/lib/auth/api";
import { type LibraryTrack, TRACK_COLUMNS } from "@/lib/library/tracks";
import {
  COVER_TYPES,
  coverPath,
  MAX_AUDIO_BYTES,
  mediaPath,
  titleFromFileName,
} from "@/lib/library/upload-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/**
 * Step 2 of an upload: once the file is in Storage, checks that it is really
 * there (and its real size) and creates the `tracks` row.
 */
export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);
  const { supabase, userId } = auth;

  const body = await readJson(request);
  const trackId = typeof body?.trackId === "string" && UUID.test(body.trackId) ? body.trackId : "";
  const mime = typeof body?.mime === "string" ? body.mime : "";
  if (!trackId || !mime) return apiError("invalid_request", 400);

  let path: string;
  try {
    path = mediaPath(userId, trackId, mime);
  } catch {
    return apiError("unsupported_type", 400);
  }
  // The path is rebuilt on the server: the client cannot point at someone else's file.
  if (body?.path !== path) return apiError("invalid_path", 400);

  const { data: info, error: infoError } = await supabase.storage.from("media").info(path);
  if (infoError || !info) return apiError("upload_missing", 400);
  const size = Number(info.size ?? body?.size ?? 0);
  if (size > MAX_AUDIO_BYTES) {
    await supabase.storage.from("media").remove([path]);
    return apiError("too_large", 400);
  }

  const duration =
    typeof body?.durationS === "number" && body.durationS >= 0 ? body.durationS : null;
  const folderId =
    typeof body?.folderId === "string" && UUID.test(body.folderId) ? body.folderId : null;

  // Same idea for the cover: only kept if it really reached the bucket.
  let cover: string | null = null;
  if (typeof body?.coverMime === "string" && COVER_TYPES[body.coverMime]) {
    const candidate = coverPath(userId, trackId, body.coverMime);
    const { data: coverInfo } = await supabase.storage.from("covers").info(candidate);
    if (coverInfo) cover = candidate;
  }

  const { data: track, error } = await supabase
    .from("tracks")
    .insert({
      id: trackId,
      source: "audio",
      origin: body?.origin === "video" ? "video" : "file",
      title: text(body?.title, 300) ?? titleFromFileName(path),
      artist: text(body?.artist, 300),
      duration_s: duration,
      storage_path: path,
      mime,
      size_bytes: size,
      folder_id: folderId,
      cover_path: cover,
    })
    .select(TRACK_COLUMNS)
    .single<LibraryTrack>();

  if (error || !track) {
    // Do not leave orphan files behind.
    await supabase.storage.from("media").remove([path]);
    if (cover) await supabase.storage.from("covers").remove([cover]);
    return apiError("save_failed", 500);
  }
  return NextResponse.json(track, { status: 201, headers: { "Cache-Control": "no-store" } });
}
