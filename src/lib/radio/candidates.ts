import { type LibraryTrack, toPlayerTrack } from "@/lib/library/tracks";
import type { SpotifyResult } from "@/lib/spotify/api";
import { spotifyResultToTrack } from "@/lib/spotify/tracks";
import { resultToTrack } from "@/lib/youtube/tracks";
import type { YouTubeResult } from "@/lib/youtube/types";
import type { Candidate } from "./score";
import { artistKey, type Signals, trackKey } from "./signals";

/** Searches per source and refill: the YouTube quota is shared and small. */
const ARTIST_QUERIES = 2;
/** Library tracks played more often than this are not "little played". */
const LITTLE_PLAYED = 3;

export interface CandidateSources {
  library: readonly LibraryTrack[];
  /** Cache-first YouTube search (null = not available). */
  searchYouTube?: ((query: string) => Promise<YouTubeResult[]>) | null;
  /** Spotify search when the account is connected (null = not connected). */
  searchSpotify?: ((query: string) => Promise<SpotifyResult[]>) | null;
}

/**
 * Candidates in the order of docs/ARCHITECTURE.md:
 * 1. Your library: little-played songs of your top artists and folders
 *    (any little-played song when there is no history yet).
 * 2. YouTube: searches for your top artists (cached results first).
 * 3. Spotify (if connected): searches for your top artists.
 * A failing source is skipped; the radio works with what it has.
 */
export async function generateCandidates(
  sources: CandidateSources,
  signals: Signals,
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const topKeys = new Set(signals.topArtists.map((name) => artistKey(name)));
  const topFolders = new Set(
    [...signals.folderAffinity.entries()].filter(([, value]) => value > 0).map(([id]) => id),
  );
  const hasHistory = signals.playCount.size > 0;

  for (const row of sources.library) {
    const track = toPlayerTrack(row);
    if ((signals.playCount.get(trackKey(track)) ?? 0) > LITTLE_PLAYED) continue;
    const artist = artistKey(row.artist);
    const relevant =
      !hasHistory ||
      (artist !== null && topKeys.has(artist)) ||
      (row.folder_id !== null && topFolders.has(row.folder_id));
    if (relevant) candidates.push({ track, origin: "library", folderId: row.folder_id });
  }

  const queries = signals.topArtists.slice(0, ARTIST_QUERIES);
  if (sources.searchYouTube) {
    for (const artist of queries) {
      const results = await sources.searchYouTube(artist).catch(() => []);
      for (const result of results) {
        candidates.push({ track: resultToTrack(result), origin: "youtube" });
      }
    }
  }
  if (sources.searchSpotify) {
    for (const artist of queries) {
      const results = await sources.searchSpotify(`artist:"${artist}"`).catch(() => []);
      for (const result of results) {
        candidates.push({ track: spotifyResultToTrack(result), origin: "spotify" });
      }
    }
  }
  return candidates;
}
