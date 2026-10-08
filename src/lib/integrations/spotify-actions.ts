"use server";

import { refresh } from "next/cache";
import { authenticate } from "@/lib/auth/api";
import { cleanClientId } from "@/lib/spotify/config";
import { clearTokens } from "@/lib/spotify/server";
import type { IntegrationActionResult } from "./youtube-actions";

/**
 * Saves the user's own Spotify app Client ID. Tokens belong to a Client ID,
 * so changing it disconnects the account (connect again afterwards).
 */
export async function saveSpotifyClientId(value: string): Promise<IntegrationActionResult> {
  const clientId = cleanClientId(value);
  if (!clientId) return { ok: false, error: "invalid_client_id" };
  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };
  const { error } = await auth.supabase.from("user_integrations").upsert(
    {
      owner_id: auth.userId,
      provider: "spotify",
      client_id: clientId,
      secret_enc: null,
      refresh_token_enc: null,
      expires_at: null,
      account_name: null,
      account_product: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,provider" },
  );
  if (error) return { ok: false, error: "failed" };
  refresh();
  return { ok: true };
}

/** "Desconectar": forgets the tokens, keeps the Client ID. */
export async function disconnectSpotify(): Promise<IntegrationActionResult> {
  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };
  await clearTokens(auth.supabase);
  refresh();
  return { ok: true };
}

/** Removes the Client ID and the connection. */
export async function removeSpotifyIntegration(): Promise<IntegrationActionResult> {
  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };
  const { error } = await auth.supabase
    .from("user_integrations")
    .delete()
    .eq("provider", "spotify");
  if (error) return { ok: false, error: "failed" };
  refresh();
  return { ok: true };
}
