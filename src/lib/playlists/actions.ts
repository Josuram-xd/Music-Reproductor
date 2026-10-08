"use server";

import { refresh } from "next/cache";
import { authenticate } from "@/lib/auth/api";
import { rebalanceRanks } from "@/lib/ds/fractional-rank";
import {
  cleanTrackIds,
  isId,
  planMove,
  type RankedItem,
  ranksForAppend,
  validatePlaylistName,
} from "./playlists";

/** Error codes are mapped to Spanish in the client (`playlistErrorMessage`). */
export type PlaylistActionResult = { ok: true; added?: number } | { ok: false; error: string };

type Supabase = NonNullable<Awaited<ReturnType<typeof authenticate>>>["supabase"];
type DbError = { code?: string } | null;

const fail = (error: string): PlaylistActionResult => ({ ok: false, error });

/** Ids per `in.(…)` filter, so the PostgREST URL stays short. */
const ID_CHUNK = 200;

function dbError(error: { code?: string }): PlaylistActionResult {
  switch (error.code) {
    case "23503": // foreign key: playlist or track missing (or someone else's)
      return fail("not_found");
    case "23514":
      return fail("invalid_name");
    default:
      return fail("failed");
  }
}

/** Runs as the signed-in user (RLS applies) and refreshes the page on success. */
async function withUser(
  run: (supabase: Supabase) => Promise<PlaylistActionResult>,
): Promise<PlaylistActionResult> {
  const auth = await authenticate();
  if (!auth) return fail("unauthorized");
  const result = await run(auth.supabase);
  if (result.ok) refresh();
  return result;
}

/** Items of a playlist in rank order. */
async function rankedItems(
  supabase: Supabase,
  playlistId: string,
): Promise<{ items: RankedItem[]; error: DbError }> {
  const { data, error } = await supabase
    .from("playlist_items")
    .select("track_id, rank")
    .eq("playlist_id", playlistId)
    .order("rank");
  return { items: data ?? [], error };
}

/** Appends tracks that are not in the playlist yet. Returns how many were added. */
async function appendTracks(
  supabase: Supabase,
  playlistId: string,
  trackIds: string[],
): Promise<PlaylistActionResult> {
  const { data: last, error: lastError } = await supabase
    .from("playlist_items")
    .select("rank")
    .eq("playlist_id", playlistId)
    .order("rank", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) return dbError(lastError);

  const present = new Set<string>();
  for (let i = 0; i < trackIds.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("playlist_items")
      .select("track_id")
      .eq("playlist_id", playlistId)
      .in("track_id", trackIds.slice(i, i + ID_CHUNK));
    if (error) return dbError(error);
    for (const row of data ?? []) present.add(row.track_id);
  }

  const fresh = trackIds.filter((id) => !present.has(id));
  if (fresh.length === 0) return { ok: true, added: 0 };
  const ranks = ranksForAppend(last?.rank ?? null, fresh.length);
  const { error } = await supabase
    .from("playlist_items")
    .insert(fresh.map((track_id, i) => ({ playlist_id: playlistId, track_id, rank: ranks[i]! })));
  if (error) return dbError(error);
  return { ok: true, added: fresh.length };
}

/**
 * `id` comes from the client so the optimistic playlist and the real one
 * match. `trackIds` fills it right away (e.g. "Guardar la cola").
 */
export async function createPlaylist(
  id: string,
  name: string,
  trackIds: string[] = [],
): Promise<PlaylistActionResult> {
  const clean = validatePlaylistName(name);
  if (!clean) return fail("invalid_name");
  const tracks = cleanTrackIds(trackIds);
  if (!isId(id) || !tracks) return fail("invalid_request");
  return withUser(async (supabase) => {
    const { error } = await supabase.from("playlists").insert({ id, name: clean });
    if (error) return dbError(error);
    if (tracks.length === 0) return { ok: true, added: 0 };
    const ranks = rebalanceRanks(tracks.length);
    const { error: itemsError } = await supabase
      .from("playlist_items")
      .insert(tracks.map((track_id, i) => ({ playlist_id: id, track_id, rank: ranks[i]! })));
    // The playlist exists anyway; report the tracks that could not be added.
    if (itemsError) return dbError(itemsError);
    return { ok: true, added: tracks.length };
  });
}

export async function renamePlaylist(id: string, name: string): Promise<PlaylistActionResult> {
  const clean = validatePlaylistName(name);
  if (!clean) return fail("invalid_name");
  if (!isId(id)) return fail("invalid_request");
  return withUser(async (supabase) => {
    const { data, error } = await supabase
      .from("playlists")
      .update({ name: clean })
      .eq("id", id)
      .select("id");
    if (error) return dbError(error);
    return data?.length ? { ok: true } : fail("not_found");
  });
}

/** Deletes the playlist; its tracks stay in the library. */
export async function deletePlaylist(id: string): Promise<PlaylistActionResult> {
  if (!isId(id)) return fail("invalid_request");
  return withUser(async (supabase) => {
    const { data, error } = await supabase.from("playlists").delete().eq("id", id).select("id");
    if (error) return dbError(error);
    return data?.length ? { ok: true } : fail("not_found");
  });
}

/** Adds tracks at the end, skipping the ones already there. */
export async function addToPlaylist(
  playlistId: string,
  trackIds: string[],
): Promise<PlaylistActionResult> {
  const tracks = cleanTrackIds(trackIds);
  if (!isId(playlistId) || !tracks || tracks.length === 0) return fail("invalid_request");
  return withUser((supabase) => appendTracks(supabase, playlistId, tracks));
}

/** Moves a track right after `afterId` (`null` = to the top). Usually rewrites one rank. */
export async function moveInPlaylist(
  playlistId: string,
  trackId: string,
  afterId: string | null,
): Promise<PlaylistActionResult> {
  if (!isId(playlistId) || !isId(trackId) || (afterId !== null && !isId(afterId))) {
    return fail("invalid_request");
  }
  return withUser(async (supabase) => {
    const { items, error } = await rankedItems(supabase, playlistId);
    if (error) return dbError(error);
    const updates = planMove(items, trackId, afterId);
    if (!updates) return fail("not_found");
    if (updates.length === 0) return { ok: true };
    if (updates.length === 1) {
      const { error: updateError } = await supabase
        .from("playlist_items")
        .update({ rank: updates[0]!.rank })
        .eq("playlist_id", playlistId)
        .eq("track_id", trackId);
      return updateError ? dbError(updateError) : { ok: true };
    }
    // Rebalance: one statement, so the deferred unique check sees the final ranks.
    const { error: upsertError } = await supabase.from("playlist_items").upsert(
      updates.map((update) => ({ playlist_id: playlistId, ...update })),
      { onConflict: "playlist_id,track_id" },
    );
    return upsertError ? dbError(upsertError) : { ok: true };
  });
}

/** Takes a track out of the playlist (not out of the library). */
export async function removeFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<PlaylistActionResult> {
  if (!isId(playlistId) || !isId(trackId)) return fail("invalid_request");
  return withUser(async (supabase) => {
    const { error } = await supabase
      .from("playlist_items")
      .delete()
      .eq("playlist_id", playlistId)
      .eq("track_id", trackId);
    return error ? dbError(error) : { ok: true };
  });
}
