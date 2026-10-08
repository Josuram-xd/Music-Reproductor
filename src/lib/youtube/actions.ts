"use server";

import { refresh } from "next/cache";
import { authenticate } from "@/lib/auth/api";
import { UUID } from "@/lib/library/folders";
import { VIDEO_ID, type YouTubeResult } from "./types";

/** Error codes are mapped to Spanish in the client (`saveVideoErrorMessage`). */
export type SaveVideoResult =
  { ok: true; trackId: string; alreadySaved: boolean } | { ok: false; error: string };

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/**
 * Saves a YouTube video in the library (optionally inside a folder), so it
 * can go into playlists and survive in the saved queue. Saving it again
 * just moves the existing row to that folder.
 */
export async function saveYouTubeVideo(
  video: Pick<YouTubeResult, "videoId" | "title" | "channel" | "durationS">,
  folderId: string | null,
): Promise<SaveVideoResult> {
  const videoId = typeof video?.videoId === "string" ? video.videoId : "";
  if (!VIDEO_ID.test(videoId)) return { ok: false, error: "invalid_request" };
  if (folderId !== null && !(typeof folderId === "string" && UUID.test(folderId))) {
    return { ok: false, error: "invalid_request" };
  }
  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };
  const { supabase } = auth;

  const { data: existing, error: findError } = await supabase
    .from("tracks")
    .select("id")
    .eq("source", "youtube")
    .eq("external_id", videoId)
    .maybeSingle();
  if (findError) return { ok: false, error: "failed" };

  if (existing) {
    const { error } = await supabase
      .from("tracks")
      .update({ folder_id: folderId })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.code === "23503" ? "not_found" : "failed" };
    refresh();
    return { ok: true, trackId: existing.id, alreadySaved: true };
  }

  const duration =
    typeof video.durationS === "number" && video.durationS >= 0 ? video.durationS : null;
  const { data, error } = await supabase
    .from("tracks")
    .insert({
      source: "youtube",
      external_id: videoId,
      title: text(video.title, 300) ?? "Vídeo de YouTube",
      artist: text(video.channel, 300),
      duration_s: duration,
      folder_id: folderId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.code === "23503" ? "not_found" : "failed" };
  }
  refresh();
  return { ok: true, trackId: data.id, alreadySaved: false };
}
