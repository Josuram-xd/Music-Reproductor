import type { Track } from "@/lib/player/types";
import type { SpotifyResult } from "./api";

/** Queue id of a Spotify search result (library tracks use their uuid). */
export function spotifyTrackId(id: string): string {
  return `sp:${id}`;
}

/** A search result as a playable track. */
export function spotifyResultToTrack(result: SpotifyResult): Track {
  return {
    id: spotifyTrackId(result.id),
    source: "spotify",
    title: result.title,
    artist: result.artists || null,
    durationS: result.durationS || null,
    externalId: result.uri,
    coverUrl: result.image,
  };
}
