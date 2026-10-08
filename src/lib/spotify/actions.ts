"use server";

import { refresh } from "next/cache";
import { authenticate } from "@/lib/auth/api";
import { UUID } from "@/lib/library/folders";
import type { SpotifyResult } from "./api";

export type SaveSpotifyTrackResult =
  { ok: true; trackId: string; alreadySaved: boolean } | { ok: false; error: string };

const SPOTIFY_TRACK_ID = /^[A-Za-z0-9]{22}$/;
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/** Saves a Spotify track in the library, optionally moving an existing entry to another folder. */
export async function saveSpotifyTrack(
  track: Pick<SpotifyResult, "id" | "uri" | "title" | "artists" | "durationS">,
  folderId: string | null,
): Promise<SaveSpotifyTrackResult> {
  const id = typeof track?.id === "string" ? track.id : "";
  const uri = typeof track?.uri === "string" ? track.uri : "";
  if (!SPOTIFY_TRACK_ID.test(id) || uri !== `spotify:track:${id}`) {
    return { ok: false, error: "invalid_request" };
  }
  if (folderId !== null && !(typeof folderId === "string" && UUID.test(folderId))) {
    return { ok: false, error: "invalid_request" };
  }

  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };
  const { supabase } = auth;

  const { data: existing, error: findError } = await supabase
    .from("tracks")
    .select("id")
    .eq("source", "spotify")
    .eq("external_id", uri)
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
    typeof track.durationS === "number" && Number.isFinite(track.durationS) && track.durationS >= 0
      ? track.durationS
      : null;
  const { data, error } = await supabase
    .from("tracks")
    .insert({
      source: "spotify",
      external_id: uri,
      title: text(track.title, 300) ?? "Canción de Spotify",
      artist: text(track.artists, 300),
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
