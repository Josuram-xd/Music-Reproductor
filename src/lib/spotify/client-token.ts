import { PlaybackError } from "@/lib/player/types";
import { SPOTIFY_TOKEN_PATH } from "./config";

/** Ask for a new token this long before the current one expires. */
const MARGIN_MS = 60_000;

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

/**
 * Access token for the Web Playback SDK and the Web API, from our server
 * (which refreshes it). Cached until shortly before it expires; concurrent
 * callers share one request.
 */
export function spotifyAccessToken(
  fetcher: typeof fetch = (...args) => fetch(...args),
  now: () => number = Date.now,
): Promise<string> {
  if (cached && cached.expiresAt - now() > MARGIN_MS) return Promise.resolve(cached.token);
  inflight ??= (async () => {
    try {
      const response = await fetcher(SPOTIFY_TOKEN_PATH, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as {
        accessToken?: string;
        expiresAt?: number;
        error?: string;
      };
      if (!response.ok || !body.accessToken || !body.expiresAt) {
        cached = null;
        throw new PlaybackError(
          "account",
          `Spotify token unavailable: ${body.error ?? response.status}`,
        );
      }
      cached = { token: body.accessToken, expiresAt: body.expiresAt };
      return body.accessToken;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Forgets the cached token (tests, sign-out). */
export function resetSpotifyToken(): void {
  cached = null;
  inflight = null;
}
