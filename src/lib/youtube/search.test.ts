import { describe, expect, test, vi } from "vitest";
import { YouTubeApiError } from "./api";
import { CACHE_TTL_MS, normalizeQuery, type SearchDeps, searchYouTube } from "./search";
import type { YouTubeResult } from "./types";

const result = (videoId: string): YouTubeResult => ({
  videoId,
  title: videoId,
  channel: "",
  durationS: 60,
  thumbnail: "",
});
const NOW = 1_000_000_000_000;

function deps(overrides: Partial<SearchDeps> = {}): SearchDeps {
  return {
    readCache: vi.fn(async () => null),
    writeCache: vi.fn(async () => {}),
    userKey: vi.fn(async () => null),
    sharedKey: "SHARED",
    search: vi.fn(async () => [result("fresh")]),
    now: () => NOW,
    ...overrides,
  };
}

describe("normalizeQuery", () => {
  test("trims, collapses spaces and lowercases", () => {
    expect(normalizeQuery("  Lo-Fi   Beats ")).toBe("lo-fi beats");
  });

  test("rejects empty, too long or non-string queries", () => {
    expect(normalizeQuery("   ")).toBeNull();
    expect(normalizeQuery("x".repeat(101))).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
  });
});

describe("searchYouTube", () => {
  test("invalid queries never reach YouTube", async () => {
    const d = deps();
    expect(await searchYouTube("  ", d)).toEqual({ ok: false, error: "invalid_query" });
    expect(d.search).not.toHaveBeenCalled();
  });

  test("a fresh cache entry costs no quota", async () => {
    const d = deps({
      readCache: vi.fn(async () => ({ results: [result("cached")], fetchedAt: NOW - 1000 })),
    });
    expect(await searchYouTube("Lofi", d)).toEqual({
      ok: true,
      response: { results: [result("cached")], origin: "cache" },
    });
    expect(d.readCache).toHaveBeenCalledWith("lofi");
    expect(d.search).not.toHaveBeenCalled();
  });

  test("the user's own key goes first and the results are cached", async () => {
    const d = deps({ userKey: vi.fn(async () => "MINE") });
    expect(await searchYouTube("lofi", d)).toMatchObject({
      ok: true,
      response: { origin: "user" },
    });
    expect(d.search).toHaveBeenCalledWith("lofi", "MINE");
    expect(d.writeCache).toHaveBeenCalledWith("lofi", [result("fresh")]);
  });

  test("without a user key the shared key is used", async () => {
    const d = deps();
    expect(await searchYouTube("lofi", d)).toMatchObject({
      ok: true,
      response: { origin: "shared" },
    });
    expect(d.search).toHaveBeenCalledWith("lofi", "SHARED");
  });

  test.each(["quota", "invalid_key"] as const)(
    "a user key with %s falls back to the shared one and says so",
    async (reason) => {
      const search = vi
        .fn()
        .mockRejectedValueOnce(new YouTubeApiError(reason, "x"))
        .mockResolvedValueOnce([result("shared")]);
      expect(await searchYouTube("lofi", deps({ userKey: async () => "MINE", search }))).toEqual({
        ok: true,
        response: { results: [result("shared")], origin: "shared", userKeyProblem: reason },
      });
    },
  );

  test("shared quota used up and no own key gives quota_exhausted", async () => {
    const search = vi.fn().mockRejectedValue(new YouTubeApiError("quota", "x"));
    expect(await searchYouTube("lofi", deps({ search }))).toEqual({
      ok: false,
      error: "quota_exhausted",
    });
  });

  test("old cached results beat an error", async () => {
    const search = vi.fn().mockRejectedValue(new YouTubeApiError("quota", "x"));
    const readCache = vi.fn(async () => ({
      results: [result("old")],
      fetchedAt: NOW - CACHE_TTL_MS - 1,
    }));
    expect(await searchYouTube("lofi", deps({ search, readCache }))).toEqual({
      ok: true,
      response: { results: [result("old")], origin: "cache", stale: true },
    });
  });

  test("a network failure does not try the other key", async () => {
    const search = vi.fn().mockRejectedValue(new YouTubeApiError("failed", "x"));
    expect(await searchYouTube("lofi", deps({ userKey: async () => "MINE", search }))).toEqual({
      ok: false,
      error: "failed",
    });
    expect(search).toHaveBeenCalledOnce();
  });

  test("no keys at all gives no_key", async () => {
    expect(await searchYouTube("lofi", deps({ sharedKey: null }))).toEqual({
      ok: false,
      error: "no_key",
    });
  });

  test("cache or key lookup failures do not break the search", async () => {
    const d = deps({
      readCache: vi.fn().mockRejectedValue(new Error("db down")),
      writeCache: vi.fn().mockRejectedValue(new Error("db down")),
      userKey: vi.fn().mockRejectedValue(new Error("db down")),
    });
    expect(await searchYouTube("lofi", d)).toMatchObject({
      ok: true,
      response: { origin: "shared" },
    });
  });
});
