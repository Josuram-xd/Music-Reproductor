/** A video found on YouTube, ready to show or to turn into a track. */
export interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  /** Seconds, or null if YouTube did not say (e.g. live streams). */
  durationS: number | null;
  thumbnail: string;
}

/** Where the results came from: the cache costs no quota. */
export type YouTubeSearchOrigin = "cache" | "user" | "shared";

export interface YouTubeSearchResponse {
  results: YouTubeResult[];
  origin: YouTubeSearchOrigin;
}

/**
 * Search error codes (mapped to Spanish in the client):
 * - `quota_exhausted`: the shared daily quota is used up (add your own key).
 * - `no_key`: the server has no shared key and the user has none either.
 */
export type YouTubeSearchError = "invalid_query" | "quota_exhausted" | "no_key" | "failed";

/** YouTube video ids are 11 characters of [A-Za-z0-9_-]. */
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Standard thumbnail URL of a video (no API call needed). */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}
