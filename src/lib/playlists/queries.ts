import "server-only";
import { requireUser } from "@/lib/auth/dal";
import { signCoverUrls } from "@/lib/library/queries";
import { type LibraryTrack, TRACK_COLUMNS } from "@/lib/library/tracks";
import { createClient } from "@/lib/supabase/server";
import { isId, type PlaylistDetail, type PlaylistName, type PlaylistSummary } from "./playlists";

const MOSAIC_SIZE = 4;

interface SummaryRow {
  id: string;
  name: string;
  items: { count: number }[];
  preview: { rank: string; track: { cover_path: string | null } | null }[];
}

/** The user's playlists (last changed first) with track count and mosaic covers. */
export async function getPlaylistSummaries(): Promise<PlaylistSummary[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlists")
    .select(
      "id, name, items:playlist_items(count), preview:playlist_items(rank, track:tracks(cover_path))",
    )
    .order("updated_at", { ascending: false })
    .order("rank", { referencedTable: "preview" })
    .limit(MOSAIC_SIZE, { referencedTable: "preview" })
    .returns<SummaryRow[]>();
  if (error) throw new Error(`Could not load the playlists: ${error.message}`);

  const rows = data ?? [];
  const covers = rows.flatMap((row) =>
    row.preview.map((item) => ({
      playlistId: row.id,
      cover_path: item.track?.cover_path ?? null,
      cover_url: null as string | null,
    })),
  );
  await signCoverUrls(supabase, covers);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    trackCount: row.items[0]?.count ?? 0,
    covers: covers.flatMap((c) => (c.playlistId === row.id && c.cover_url ? [c.cover_url] : [])),
  }));
}

/** One playlist with its tracks in order, or `null` if it does not exist (or is not theirs). */
export async function getPlaylist(id: string): Promise<PlaylistDetail | null> {
  await requireUser();
  if (!isId(id)) return null;
  const supabase = await createClient();
  const [playlistResult, itemsResult] = await Promise.all([
    supabase.from("playlists").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("playlist_items")
      .select(`rank, track:tracks(${TRACK_COLUMNS})`)
      .eq("playlist_id", id)
      .order("rank")
      .returns<{ rank: string; track: LibraryTrack | null }[]>(),
  ]);
  if (playlistResult.error) {
    throw new Error(`Could not load the playlist: ${playlistResult.error.message}`);
  }
  if (itemsResult.error) {
    throw new Error(`Could not load the playlist tracks: ${itemsResult.error.message}`);
  }
  if (!playlistResult.data) return null;

  const tracks = (itemsResult.data ?? []).flatMap((item) => (item.track ? [item.track] : []));
  await signCoverUrls(supabase, tracks);
  return { ...playlistResult.data, tracks };
}

/** Just ids and names (last changed first), for the sidebar and "Añadir a…". */
export async function getPlaylistNames(): Promise<PlaylistName[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlists")
    .select("id, name")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not load the playlists: ${error.message}`);
  return data ?? [];
}
