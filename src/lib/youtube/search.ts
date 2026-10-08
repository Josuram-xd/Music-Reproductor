import { YouTubeApiError, type YouTubeApiErrorReason } from "./api";
import type {
  YouTubeResult,
  YouTubeSearchError,
  YouTubeSearchOrigin,
  YouTubeSearchResponse,
} from "./types";

/** Cached results are reused for a day: popular searches cost quota once. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_QUERY_LENGTH = 100;

/** Cache key: trimmed, single spaces, lowercase. `null` if empty or too long. */
export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const query = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return query.length > 0 && query.length <= MAX_QUERY_LENGTH ? query : null;
}

export interface SearchDeps {
  readCache: (query: string) => Promise<{ results: YouTubeResult[]; fetchedAt: number } | null>;
  writeCache: (query: string, results: YouTubeResult[]) => Promise<void>;
  /** The user's own key (decrypted), if they saved one. */
  userKey: () => Promise<string | null>;
  /** The server's shared key (`YOUTUBE_API_KEY`). */
  sharedKey: string | null;
  search: (query: string, key: string) => Promise<YouTubeResult[]>;
  now?: () => number;
}

export type SearchResult =
  | {
      ok: true;
      response: YouTubeSearchResponse & {
        /** The user's key failed and the shared one was used (or cache): tell them. */
        userKeyProblem?: Exclude<YouTubeApiErrorReason, "failed">;
        /** Old cached results served because no key could search right now. */
        stale?: boolean;
      };
    }
  | { ok: false; error: YouTubeSearchError };

/**
 * Searches YouTube spending as little quota as possible:
 * fresh cache → the user's own key (priority) → the shared key.
 * If no key can search (quota used up, network), old cached results are
 * better than nothing.
 */
export async function searchYouTube(rawQuery: unknown, deps: SearchDeps): Promise<SearchResult> {
  const query = normalizeQuery(rawQuery);
  if (!query) return { ok: false, error: "invalid_query" };
  const now = deps.now ?? Date.now;

  const cached = await deps.readCache(query).catch(() => null);
  if (cached && now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ok: true, response: { results: cached.results, origin: "cache" } };
  }

  const keys: { origin: YouTubeSearchOrigin; key: string }[] = [];
  const userKey = await deps.userKey().catch(() => null);
  if (userKey) keys.push({ origin: "user", key: userKey });
  if (deps.sharedKey) keys.push({ origin: "shared", key: deps.sharedKey });

  let userKeyProblem: Exclude<YouTubeApiErrorReason, "failed"> | undefined;
  let lastError: YouTubeApiErrorReason | null = null;
  for (const { origin, key } of keys) {
    try {
      const results = await deps.search(query, key);
      await deps.writeCache(query, results).catch(() => undefined);
      return {
        ok: true,
        response: { results, origin, ...(userKeyProblem ? { userKeyProblem } : {}) },
      };
    } catch (error) {
      const reason = error instanceof YouTubeApiError ? error.reason : "failed";
      lastError = reason;
      if (origin === "user" && reason !== "failed") userKeyProblem = reason;
      // A network failure would fail with any key: stop here.
      if (reason === "failed") break;
    }
  }

  if (cached) {
    return {
      ok: true,
      response: {
        results: cached.results,
        origin: "cache",
        stale: true,
        ...(userKeyProblem ? { userKeyProblem } : {}),
      },
    };
  }
  if (keys.length === 0) return { ok: false, error: "no_key" };
  return { ok: false, error: lastError === "failed" ? "failed" : "quota_exhausted" };
}
