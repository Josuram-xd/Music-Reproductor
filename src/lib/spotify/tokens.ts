import { SpotifyAuthError, type SpotifyTokens } from "./oauth";

/** Refresh a bit before expiry so the SDK never gets a token that dies mid-request. */
export const REFRESH_MARGIN_MS = 60_000;

/** What the database holds for the user's Spotify connection (decrypted). */
export interface StoredSpotify {
  /** The user's own Client ID; `null` = the server's (owner). */
  clientId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Epoch ms. */
  expiresAt: number | null;
}

export interface TokenDeps {
  load: () => Promise<StoredSpotify | null>;
  save: (tokens: SpotifyTokens) => Promise<void>;
  /** Forgets the tokens (keeps the Client ID): the user must connect again. */
  clear: () => Promise<void>;
  serverClientId: string | null;
  refresh: (args: { refreshToken: string; clientId: string }) => Promise<SpotifyTokens>;
  now?: () => number;
}

export type AccessTokenResult =
  | { ok: true; accessToken: string; expiresAt: number }
  | { ok: false; error: "not_connected" | "reauth" | "failed" };

const usable = (stored: StoredSpotify | null, now: number) =>
  stored?.accessToken && stored.expiresAt && stored.expiresAt - now > REFRESH_MARGIN_MS
    ? { ok: true as const, accessToken: stored.accessToken, expiresAt: stored.expiresAt }
    : null;

/**
 * A valid access token for the Web Playback SDK and the Web API, refreshing
 * it when needed. The refresh token never leaves the server.
 */
export async function getAccessToken(deps: TokenDeps): Promise<AccessTokenResult> {
  const now = deps.now ?? Date.now;
  const stored = await deps.load();
  const clientId = stored?.clientId ?? deps.serverClientId;
  if (!stored?.refreshToken || !clientId) return { ok: false, error: "not_connected" };

  const current = usable(stored, now());
  if (current) return current;

  try {
    const tokens = await deps.refresh({ refreshToken: stored.refreshToken, clientId });
    await deps.save(tokens);
    return { ok: true, accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
  } catch (error) {
    const reason = error instanceof SpotifyAuthError ? error.reason : "failed";
    if (reason === "failed") return { ok: false, error: "failed" };
    // Another request may have refreshed (and rotated the refresh token) meanwhile.
    const latest = await deps.load();
    if (latest?.refreshToken !== stored.refreshToken) {
      const fresh = usable(latest, now());
      if (fresh) return fresh;
    }
    await deps.clear();
    return { ok: false, error: "reauth" };
  }
}
