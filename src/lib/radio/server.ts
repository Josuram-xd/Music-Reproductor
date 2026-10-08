import "server-only";
import { addYouTubeThumbnails } from "@/lib/youtube/tracks";
import { signCoverUrls } from "@/lib/library/queries";
import { type LibraryTrack, TRACK_COLUMNS, toPlayerTrack } from "@/lib/library/tracks";
import type { Track } from "@/lib/player/types";
import { searchTracks } from "@/lib/spotify/api";
import { spotifyAccessToken } from "@/lib/spotify/server";
import type { createClient } from "@/lib/supabase/server";
import type { SearchSource } from "@/lib/supabase/database.types";
import { searchYouTube } from "@/lib/youtube/search";
import { youtubeSearchDeps } from "@/lib/youtube/server";
import { generateCandidates } from "./candidates";
import { pickRecommendations } from "./score";
import { buildSignals } from "./signals";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** History considered: the last 90 days, up to this many plays. */
const HISTORY_DAYS = 90;
const HISTORY_LIMIT = 1000;
const SEARCH_LIMIT = 20;

/** Remembers a search (a radio signal). Failures are ignored: it is only a hint. */
export async function recordSearch(
  supabase: Supabase,
  query: string,
  source: SearchSource,
): Promise<void> {
  const clean = query.trim().slice(0, 100);
  if (!clean) return;
  await supabase
    .from("search_history")
    .insert({ query: clean, source })
    .then(
      () => undefined,
      () => undefined,
    );
}

/**
 * Up to `count` recommendations for the signed-in user: reads the history,
 * builds the signals, gathers candidates (library → YouTube → Spotify) and
 * picks the best with the Max-Heap. `exclude` = track keys already queued.
 */
export async function recommend(
  supabase: Supabase,
  userId: string,
  { count, exclude }: { count: number; exclude: Set<string> },
): Promise<Track[]> {
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [events, feedback, searches, library] = await Promise.all([
    supabase
      .from("play_events")
      .select("track_id, source, external_id, artist, started_at, completed, skipped")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase.from("radio_feedback").select("artist, score"),
    supabase
      .from("search_history")
      .select("query")
      .order("created_at", { ascending: false })
      .limit(SEARCH_LIMIT),
    supabase.from("tracks").select(TRACK_COLUMNS).returns<LibraryTrack[]>(),
  ]);

  const libraryRows = library.data ?? [];
  const folderOf = new Map(libraryRows.map((row) => [row.id, row.folder_id]));
  const signals = buildSignals({
    events: events.data ?? [],
    feedback: feedback.data ?? [],
    searches: (searches.data ?? []).map((row) => row.query),
    folderOf: (id) => folderOf.get(id) ?? null,
    now: Date.now(),
  });

  const youtubeDeps = youtubeSearchDeps(supabase);
  const spotifyToken = await spotifyAccessToken(supabase, userId).catch(() => null);
  const candidates = await generateCandidates(
    {
      library: libraryRows,
      searchYouTube: async (query) => {
        const result = await searchYouTube(query, youtubeDeps);
        return result.ok ? result.response.results : [];
      },
      searchSpotify: spotifyToken?.ok
        ? (query) => searchTracks(query, spotifyToken.accessToken)
        : null,
    },
    signals,
  );

  const picked = pickRecommendations(candidates, signals, { count, exclude });

  // Library picks need their (signed) covers; the rest already have one.
  const pickedRows = libraryRows.filter((row) => picked.some((track) => track.id === row.id));
  await signCoverUrls(supabase, pickedRows);
  addYouTubeThumbnails(pickedRows);
  const covers = new Map(pickedRows.map((row) => [row.id, toPlayerTrack(row).coverUrl]));
  return picked.map((track) =>
    covers.has(track.id) ? { ...track, coverUrl: covers.get(track.id) ?? null } : track,
  );
}
