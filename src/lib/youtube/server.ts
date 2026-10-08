import "server-only";
import { decryptSecret } from "@/lib/crypto/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { searchVideos } from "./api";
import type { SearchDeps } from "./search";
import type { YouTubeResult } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The signed-in user's own YouTube key, decrypted, or `null`. */
export async function getUserYouTubeKey(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select("secret_enc")
    .eq("provider", "youtube")
    .maybeSingle();
  if (!data?.secret_enc) return null;
  try {
    return decryptSecret(data.secret_enc);
  } catch {
    // Encrypted with an old ENCRYPTION_KEY: as if there were none.
    return null;
  }
}

/** Real dependencies of `searchYouTube` for the signed-in user. */
export function youtubeSearchDeps(supabase: Supabase): SearchDeps {
  return {
    async readCache(query) {
      const { data } = await createAdminClient()
        .from("yt_search_cache")
        .select("results, fetched_at")
        .eq("query", query)
        .maybeSingle();
      return data
        ? { results: data.results as YouTubeResult[], fetchedAt: Date.parse(data.fetched_at) }
        : null;
    },
    async writeCache(query, results) {
      await createAdminClient()
        .from("yt_search_cache")
        .upsert({ query, results, fetched_at: new Date().toISOString() });
    },
    userKey: () => getUserYouTubeKey(supabase),
    sharedKey: process.env.YOUTUBE_API_KEY || null,
    search: (query, key) => searchVideos(query, key),
  };
}
