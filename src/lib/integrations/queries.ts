import "server-only";
import { requireUser } from "@/lib/auth/dal";
import { serverClientIdFor } from "@/lib/spotify/server";
import { createClient } from "@/lib/supabase/server";

export interface YouTubeIntegration {
  /** "…abcd" if the user saved their own key, else null. */
  keyHint: string | null;
  /** The server has a shared key everyone can use. */
  hasSharedKey: boolean;
}

export async function getYouTubeIntegration(): Promise<YouTubeIntegration> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_integrations")
    .select("secret_hint, secret_enc")
    .eq("provider", "youtube")
    .maybeSingle();
  return {
    keyHint: data?.secret_enc ? (data.secret_hint ?? "…") : null,
    hasSharedKey: Boolean(process.env.YOUTUBE_API_KEY),
  };
}

export interface SpotifyIntegration {
  /** The user's own Client ID, if they saved one. */
  clientId: string | null;
  /** The owner can connect with the server's Client ID without pasting one. */
  hasServerClientId: boolean;
  connected: boolean;
  accountName: string | null;
  /** "premium", "free"… `null` if unknown. */
  product: string | null;
}

export async function getSpotifyIntegration(): Promise<SpotifyIntegration> {
  await requireUser();
  const supabase = await createClient();
  const [{ data }, serverClientId] = await Promise.all([
    supabase
      .from("user_integrations")
      .select("client_id, refresh_token_enc, account_name, account_product")
      .eq("provider", "spotify")
      .maybeSingle(),
    serverClientIdFor(),
  ]);
  return {
    clientId: data?.client_id ?? null,
    hasServerClientId: serverClientId !== null,
    connected: Boolean(data?.refresh_token_enc),
    accountName: data?.account_name ?? null,
    product: data?.account_product ?? null,
  };
}
