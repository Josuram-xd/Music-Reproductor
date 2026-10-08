import type { Track } from "@/lib/player/types";
import type { TrackRow } from "@/lib/supabase/database.types";

/** Columns the app reads from `tracks`. */
export const TRACK_COLUMNS =
  "id, folder_id, source, origin, title, artist, duration_s, storage_path, external_id, mime, size_bytes, cover_path, created_at";

export type LibraryTrack = Pick<
  TrackRow,
  | "id"
  | "folder_id"
  | "source"
  | "origin"
  | "title"
  | "artist"
  | "duration_s"
  | "storage_path"
  | "external_id"
  | "mime"
  | "size_bytes"
  | "cover_path"
  | "created_at"
> & {
  /** Short-lived signed URL of the cover (private bucket), added when listing. */
  cover_url?: string | null;
};

/** DB row → what the player needs. */
export function toPlayerTrack(row: LibraryTrack): Track {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    artist: row.artist,
    durationS: row.duration_s === null ? null : Number(row.duration_s),
    storagePath: row.storage_path,
    externalId: row.external_id,
    coverUrl: row.cover_url ?? null,
  };
}
