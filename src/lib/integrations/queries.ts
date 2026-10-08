import "server-only";
import { requireUser } from "@/lib/auth/dal";
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
