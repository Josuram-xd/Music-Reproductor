import "server-only";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { FOLDER_COLUMNS, type LibraryFolder } from "./folders";
import { type LibraryTrack, TRACK_COLUMNS } from "./tracks";

/** Signed cover URLs last this long; the page re-signs them on every render. */
const COVER_URL_TTL_S = 60 * 60;

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

  // Covers live in a private bucket: one batch call signs them all.
  const coverPaths = tracks.flatMap((t) => (t.cover_path ? [t.cover_path] : []));
  if (coverPaths.length > 0) {
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

  return { tracks, folders: foldersResult.data ?? [] };
}
