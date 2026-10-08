import { SPOTIFY_SCOPES } from "./config";

const ACCOUNTS = "https://accounts.spotify.com";

/** Why a token request failed: `invalid_grant` means the user must connect again. */
export type SpotifyAuthErrorReason = "invalid_grant" | "invalid_client" | "failed";

export class SpotifyAuthError extends Error {
  constructor(
    readonly reason: SpotifyAuthErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

export interface SpotifyTokens {
  accessToken: string;
  /** Spotify may rotate it; `null` = keep the old one. */
  refreshToken: string | null;
  /** Epoch ms. */
  expiresAt: number;
}

type Fetch = typeof fetch;

export function authorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });
  return `${ACCOUNTS}/authorize?${params}`;
}

async function tokenRequest(
  body: Record<string, string>,
  fetcher: Fetch,
  now: () => number,
): Promise<SpotifyTokens> {
  let response: Response;
  try {
    response = await fetcher(`${ACCOUNTS}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new SpotifyAuthError("failed", `Spotify token request failed: ${String(error)}`);
  }
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    const reason: SpotifyAuthErrorReason =
      data.error === "invalid_grant"
        ? "invalid_grant"
        : data.error === "invalid_client"
          ? "invalid_client"
          : "failed";
    throw new SpotifyAuthError(reason, data.error_description ?? `HTTP ${response.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: now() + (data.expires_in ?? 3600) * 1000,
  };
}

/** Authorization code + PKCE verifier → tokens (no client secret needed). */
export function exchangeCode(
  args: { code: string; redirectUri: string; clientId: string; codeVerifier: string },
  fetcher: Fetch = fetch,
  now: () => number = Date.now,
): Promise<SpotifyTokens> {
  return tokenRequest(
    {
      grant_type: "authorization_code",
      code: args.code,
      redirect_uri: args.redirectUri,
      client_id: args.clientId,
      code_verifier: args.codeVerifier,
    },
    fetcher,
    now,
  );
}

/** New access token from the refresh token (PKCE apps need no secret here either). */
export function refreshTokens(
  args: { refreshToken: string; clientId: string },
  fetcher: Fetch = fetch,
  now: () => number = Date.now,
): Promise<SpotifyTokens> {
  return tokenRequest(
    { grant_type: "refresh_token", refresh_token: args.refreshToken, client_id: args.clientId },
    fetcher,
    now,
  );
}
