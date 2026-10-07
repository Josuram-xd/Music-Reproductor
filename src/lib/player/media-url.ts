import { LRUCache } from "@/lib/ds/lru-cache";
import { createClient } from "@/lib/supabase/client";
import type { Track } from "./types";

const MEDIA_BUCKET = "media";
const SIGNED_URL_TTL_S = 60 * 60;
/** Reuse URLs a bit less than their lifetime so they never expire mid-request. */
const CACHE_TTL_MS = (SIGNED_URL_TTL_S - 5 * 60) * 1000;

const cache = new LRUCache<string, string>({ capacity: 200, ttlMs: CACHE_TTL_MS });

/** Signed URL for an uploaded track in the private `media` bucket, cached (LRU). */
export async function signedMediaUrl(track: Track): Promise<string> {
  const path = track.storagePath;
  if (!path) throw new Error(`Track "${track.id}" has no storage path`);
  const cached = cache.get(path);
  if (cached) return cached;

  const { data, error } = await createClient()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_S);
  if (error || !data) throw error ?? new Error("Could not sign the media URL");
  cache.set(path, data.signedUrl);
  return data.signedUrl;
}
