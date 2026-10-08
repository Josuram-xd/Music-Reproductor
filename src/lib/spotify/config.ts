/** Spotify app Client IDs are 32 hex characters. */
export const SPOTIFY_CLIENT_ID = /^[0-9a-f]{32}$/i;

export function cleanClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return SPOTIFY_CLIENT_ID.test(id) ? id.toLowerCase() : null;
}

/** Spotify requires the IP loopback host instead of `localhost` for local OAuth. */
export function spotifyOAuthOrigin(origin: string): string {
  const url = new URL(origin);
  if (url.protocol === "http:" && url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }
  return url.origin;
}

/** Path of the OAuth callback; the user registers `<origin>` + this in their Spotify app. */
export const SPOTIFY_CALLBACK_PATH = "/api/spotify/callback";
export const SPOTIFY_LOGIN_PATH = "/api/spotify/login";
export const SPOTIFY_TOKEN_PATH = "/api/spotify/token";
export const SPOTIFY_SEARCH_PATH = "/api/spotify/search";

/** Playback in the browser (Web Playback SDK) + controlling it + knowing if Premium. */
export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
];

/** `?spotify=…` on /settings after the OAuth round trip. */
export type SpotifyConnectStatus =
  "connected" | "denied" | "no_client_id" | "state_mismatch" | "invalid_client" | "failed";

export const SPOTIFY_CONNECT_STATUSES: readonly SpotifyConnectStatus[] = [
  "connected",
  "denied",
  "no_client_id",
  "state_mismatch",
  "invalid_client",
  "failed",
];
