import { type YouTubeResult, youtubeThumbnail } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
export const MAX_RESULTS = 15;

/** Why a call with a given key failed: decides whether to try the next key. */
export type YouTubeApiErrorReason = "quota" | "invalid_key" | "failed";

export class YouTubeApiError extends Error {
  constructor(
    readonly reason: YouTubeApiErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

type Fetch = typeof fetch;

interface ApiErrorBody {
  error?: { code?: number; message?: string; errors?: { reason?: string }[] };
}

const QUOTA_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"]);
const KEY_REASONS = new Set(["keyInvalid", "keyExpired", "forbidden", "accessNotConfigured"]);

async function call<T>(fetcher: Fetch, path: string, params: Record<string, string>): Promise<T> {
  const url = `${API}/${path}?${new URLSearchParams(params)}`;
  let response: Response;
  try {
    response = await fetcher(url, { cache: "no-store" });
  } catch (error) {
    throw new YouTubeApiError("failed", `YouTube request failed: ${String(error)}`);
  }
  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  const reasons = (body.error?.errors ?? []).map((e) => e.reason ?? "");
  const message = body.error?.message ?? `HTTP ${response.status}`;
  if (reasons.some((r) => QUOTA_REASONS.has(r))) throw new YouTubeApiError("quota", message);
  if (
    reasons.some((r) => KEY_REASONS.has(r)) ||
    (response.status === 400 && /API key/i.test(message))
  ) {
    throw new YouTubeApiError("invalid_key", message);
  }
  throw new YouTubeApiError("failed", message);
}

/** "PT1H2M3S" → 3723. Null for live streams ("P0D") or anything unexpected. */
export function parseIsoDuration(value: string | undefined): number | null {
  const match = value?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const [, d = "0", h = "0", m = "0", s = "0"] = match;
  const total = Number(d) * 86400 + Number(h) * 3600 + Number(m) * 60 + Number(s);
  return total > 0 ? total : null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

/** The API returns titles HTML-escaped ("Rock &amp; Roll"). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (ENTITIES[code]) return ENTITIES[code];
    if (code.startsWith("#x")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
    return entity;
  });
}

interface SearchBody {
  items?: {
    id?: { videoId?: string };
    snippet?: { title?: string; channelTitle?: string };
  }[];
}
interface VideosBody {
  items?: { id?: string; contentDetails?: { duration?: string } }[];
}

/**
 * Searches embeddable videos (100 quota units) and adds their length
 * (videos.list, 1 unit). Throws `YouTubeApiError`.
 */
export async function searchVideos(
  query: string,
  key: string,
  fetcher: Fetch = fetch,
): Promise<YouTubeResult[]> {
  const search = await call<SearchBody>(fetcher, "search", {
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: String(MAX_RESULTS),
    q: query,
    key,
  });
  const found = (search.items ?? []).flatMap((item) => {
    const videoId = item.id?.videoId;
    return videoId ? [{ videoId, snippet: item.snippet }] : [];
  });
  if (found.length === 0) return [];

  // Lengths are nice to have: if this second call fails, keep the results.
  const durations = new Map<string, number | null>();
  try {
    const videos = await call<VideosBody>(fetcher, "videos", {
      part: "contentDetails",
      id: found.map((f) => f.videoId).join(","),
      key,
    });
    for (const video of videos.items ?? []) {
      if (video.id) durations.set(video.id, parseIsoDuration(video.contentDetails?.duration));
    }
  } catch {
    // Without lengths.
  }

  return found.map(({ videoId, snippet }) => ({
    videoId,
    title: decodeEntities(snippet?.title ?? "Sin título"),
    channel: decodeEntities(snippet?.channelTitle ?? ""),
    durationS: durations.get(videoId) ?? null,
    thumbnail: youtubeThumbnail(videoId),
  }));
}

/** Checks that a key works with a 1-unit call. Throws `YouTubeApiError`. */
export async function verifyKey(key: string, fetcher: Fetch = fetch): Promise<void> {
  await call(fetcher, "videos", { part: "id", id: "dQw4w9WgXcQ", key });
}
