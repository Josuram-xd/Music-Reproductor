import type { Track } from "@/lib/player/types";
import { type YouTubeResult, youtubeThumbnail } from "./types";

/** Queue id of a search result that is not in the library (library tracks use their uuid). */
export function youtubeTrackId(videoId: string): string {
  return `yt:${videoId}`;
}

/** A search result as a playable track (not saved in the library). */
export function resultToTrack(result: YouTubeResult): Track {
  return {
    id: youtubeTrackId(result.videoId),
    source: "youtube",
    title: result.title,
    artist: result.channel || null,
    durationS: result.durationS,
    externalId: result.videoId,
  };
}

/** Cover for library rows of YouTube videos: their thumbnail (no Storage file). */
export function addYouTubeThumbnails<
  T extends { source: string; external_id: string | null; cover_url?: string | null },
>(tracks: T[]): T[] {
  for (const track of tracks) {
    if (track.source === "youtube" && track.external_id && !track.cover_url) {
      track.cover_url = youtubeThumbnail(track.external_id);
    }
  }
  return tracks;
}
