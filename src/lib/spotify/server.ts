import "server-only";
import { getCurrentUser } from "@/lib/auth/dal";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import type { createClient } from "@/lib/supabase/server";
import type { SpotifyProfile } from "./api";
import { refreshTokens, type SpotifyTokens } from "./oauth";
import { type AccessTokenResult, getAccessToken, type StoredSpotify } from "./tokens";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const COLUMNS = "client_id, secret_enc, refresh_token_enc, expires_at";

function decrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    // Encrypted with an old ENCRYPTION_KEY: as if there were none.
    return null;
  }
}

/** The server's Client ID (`SPOTIFY_CLIENT_ID`), only for the owner (docs/ARCHITECTURE.md). */
export async function serverClientIdFor(): Promise<string | null> {
  const user = await getCurrentUser();
  const id = process.env.SPOTIFY_CLIENT_ID;
  return user?.role === "owner" && id ? id : null;
}

/** The Client ID the user connects with: their own, else the server's (owner). */
export async function resolveClientId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select("client_id")
    .eq("provider", "spotify")
    .maybeSingle();
  return data?.client_id ?? (await serverClientIdFor());
}

async function loadStored(supabase: Supabase): Promise<StoredSpotify | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select(COLUMNS)
    .eq("provider", "spotify")
    .maybeSingle();
  if (!data) return null;
  return {
    clientId: data.client_id,
    accessToken: decrypt(data.secret_enc),
    refreshToken: decrypt(data.refresh_token_enc),
    expiresAt: data.expires_at ? Date.parse(data.expires_at) : null,
  };
}

/** Saves fresh tokens (encrypted). A missing refresh token keeps the old one. */
export async function saveTokens(
  supabase: Supabase,
  userId: string,
  tokens: SpotifyTokens,
  extra: { clientId?: string | null; profile?: SpotifyProfile } = {},
): Promise<boolean> {
  const { error } = await supabase.from("user_integrations").upsert(
    {
      owner_id: userId,
      provider: "spotify",
      secret_enc: encryptSecret(tokens.accessToken),
      ...(tokens.refreshToken ? { refresh_token_enc: encryptSecret(tokens.refreshToken) } : {}),
      expires_at: new Date(tokens.expiresAt).toISOString(),
      ...(extra.clientId !== undefined ? { client_id: extra.clientId } : {}),
      ...(extra.profile
        ? {
            account_name: extra.profile.name.slice(0, 200),
            account_product: extra.profile.product?.slice(0, 40) ?? null,
          }
        : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,provider" },
  );
  return !error;
}

/** Forgets the tokens and account; keeps the user's Client ID. */
export async function clearTokens(supabase: Supabase): Promise<void> {
  await supabase
    .from("user_integrations")
    .update({
      secret_enc: null,
      refresh_token_enc: null,
      expires_at: null,
      account_name: null,
      account_product: null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "spotify");
}

/** A valid access token for the signed-in user, refreshed if needed. */
export async function spotifyAccessToken(
  supabase: Supabase,
  userId: string,
): Promise<AccessTokenResult> {
  return getAccessToken({
    load: () => loadStored(supabase),
    save: async (tokens) => {
      await saveTokens(supabase, userId, tokens);
    },
    clear: () => clearTokens(supabase),
    serverClientId: await serverClientIdFor(),
    refresh: (args) => refreshTokens(args),
  });
}
