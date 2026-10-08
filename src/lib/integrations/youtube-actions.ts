"use server";

import { refresh } from "next/cache";
import { authenticate } from "@/lib/auth/api";
import { encryptSecret } from "@/lib/crypto/secrets";
import { verifyKey, YouTubeApiError } from "@/lib/youtube/api";
import { cleanYouTubeKey, keyHint } from "@/lib/youtube/key";

/** Error codes are mapped to Spanish in the client (`youtubeKeyErrorMessage`). */
export type IntegrationActionResult = { ok: true } | { ok: false; error: string };

/**
 * Saves the user's own YouTube API key (checked with a 1-unit call, then
 * encrypted). It is used before the shared key for their searches.
 */
export async function saveYouTubeKey(value: string): Promise<IntegrationActionResult> {
  const key = cleanYouTubeKey(value);
  if (!key) return { ok: false, error: "invalid_format" };
  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };

  try {
    await verifyKey(key);
  } catch (error) {
    const reason = error instanceof YouTubeApiError ? error.reason : "failed";
    // A key with no quota left today is still a valid key: keep it.
    if (reason === "invalid_key") return { ok: false, error: "invalid_key" };
    if (reason === "failed") return { ok: false, error: "verify_failed" };
  }

  let secret: string;
  try {
    secret = encryptSecret(key);
  } catch {
    return { ok: false, error: "server_config" };
  }
  const { error } = await auth.supabase.from("user_integrations").upsert(
    {
      owner_id: auth.userId,
      provider: "youtube",
      secret_enc: secret,
      secret_hint: keyHint(key),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,provider" },
  );
  if (error) return { ok: false, error: "failed" };
  refresh();
  return { ok: true };
}

export async function deleteYouTubeKey(): Promise<IntegrationActionResult> {
  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };
  const { error } = await auth.supabase
    .from("user_integrations")
    .delete()
    .eq("provider", "youtube");
  if (error) return { ok: false, error: "failed" };
  refresh();
  return { ok: true };
}
