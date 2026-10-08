import "server-only";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { FOLDER_COLUMNS, type LibraryFolder } from "./folders";
import { addYouTubeThumbnails } from "@/lib/youtube/tracks";
import { type LibraryTrack, TRACK_COLUMNS } from "./tracks";

/** Signed cover URLs last this long; the page re-signs them on every render. */
const COVER_URL_TTL_S = 60 * 60;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Adds `cover_url` to each track: covers live in a private bucket, so they
 * get short-lived signed URLs (one batch call for all of them).
 */
export async function signCoverUrls(
  supabase: Supabase,
  tracks: Pick<LibraryTrack, "cover_path" | "cover_url">[],
): Promise<void> {
  const coverPaths = [...new Set(tracks.flatMap((t) => (t.cover_path ? [t.cover_path] : [])))];
  if (coverPaths.length === 0) return;
  const { data: signed } = await supabase.storage
    .from("covers")
    .createSignedUrls(coverPaths, COVER_URL_TTL_S);
  const urls = new Map(
    (signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])),
  );
  for (const track of tracks) {
    track.cover_url = track.cover_path ? (urls.get(track.cover_path) ?? null) : null;
  }
}

export interface Library {
  tracks: LibraryTrack[];
  folders: LibraryFolder[];
}

/** The signed-in user's tracks (newest first) and folders. RLS limits them to their own. */
export async function getLibrary(): Promise<Library> {
  await requireUser();
  const supabase = await createClient();
  const [tracksResult, foldersResult] = await Promise.all([
    supabase
      .from("tracks")
      .select(TRACK_COLUMNS)
      .order("created_at", { ascending: false })
      .returns<LibraryTrack[]>(),
    supabase.from("folders").select(FOLDER_COLUMNS).returns<LibraryFolder[]>(),
  ]);
  if (tracksResult.error) {
    throw new Error(`Could not load the library: ${tracksResult.error.message}`);
  }
  if (foldersResult.error) {
    throw new Error(`Could not load the folders: ${foldersResult.error.message}`);
  }
  const tracks = tracksResult.data ?? [];
  await signCoverUrls(supabase, tracks);
  addYouTubeThumbnails(tracks);

  return { tracks, folders: foldersResult.data ?? [] };
}

/** Only the folders (for pages that do not list the tracks, e.g. YouTube search). */
export async function getFolders(): Promise<LibraryFolder[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("folders").select(FOLDER_COLUMNS);
  if (error) throw new Error(`Could not load the folders: ${error.message}`);
  return (data ?? []) as LibraryFolder[];
}
