import { describe, expect, test, vi } from "vitest";
import { decodeEntities, parseIsoDuration, searchVideos, verifyKey, YouTubeApiError } from "./api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const apiError = (status: number, reason: string, message = "nope") =>
  json({ error: { code: status, message, errors: [{ reason }] } }, status);

describe("parseIsoDuration", () => {
  test.each([
    ["PT3M5S", 185],
    ["PT1H2M3S", 3723],
    ["PT45S", 45],
    ["P1DT1S", 86401],
    ["P0D", null],
    ["nonsense", null],
    [undefined, null],
  ])("%s → %s", (value, seconds) => {
    expect(parseIsoDuration(value)).toBe(seconds);
  });
});

describe("decodeEntities", () => {
  test("decodes the entities YouTube uses in titles", () => {
    expect(decodeEntities("Rock &amp; Roll &quot;live&quot; &#39;99 &#x2665; &lt;3")).toBe(
      `Rock & Roll "live" '99 ♥ <3`,
    );
    expect(decodeEntities("&unknown;")).toBe("&unknown;");
  });
});

describe("searchVideos", () => {
  test("returns results with lengths and thumbnails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          items: [
            {
              id: { videoId: "aaaaaaaaaaa" },
              snippet: { title: "Nyan &amp; Cat", channelTitle: "Cats" },
            },
            { id: {}, snippet: { title: "a channel, not a video" } },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({ items: [{ id: "aaaaaaaaaaa", contentDetails: { duration: "PT3M" } }] }),
      );

    const results = await searchVideos("nyan cat", "KEY", fetcher);
    expect(results).toEqual([
      {
        videoId: "aaaaaaaaaaa",
        title: "Nyan & Cat",
        channel: "Cats",
        durationS: 180,
        thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg",
      },
    ]);
    const searchUrl = new URL(fetcher.mock.calls[0]![0] as string);
    expect(searchUrl.pathname).toBe("/youtube/v3/search");
    expect(searchUrl.searchParams.get("videoEmbeddable")).toBe("true");
    expect(searchUrl.searchParams.get("q")).toBe("nyan cat");
    expect(searchUrl.searchParams.get("key")).toBe("KEY");
  });

  test("keeps the results if the lengths call fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ items: [{ id: { videoId: "bbbbbbbbbbb" }, snippet: {} }] }))
      .mockResolvedValueOnce(json({}, 500));
    const [result] = await searchVideos("x", "KEY", fetcher);
    expect(result).toMatchObject({ videoId: "bbbbbbbbbbb", durationS: null, title: "Sin título" });
  });

  test("no results skip the second call", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ items: [] }));
    expect(await searchVideos("x", "KEY", fetcher)).toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  test.each([
    [403, "quotaExceeded", "nope", "quota"],
    [403, "dailyLimitExceeded", "nope", "quota"],
    [400, "keyInvalid", "nope", "invalid_key"],
    [400, "badRequest", "API key not valid. Please pass a valid API key.", "invalid_key"],
    [500, "backendError", "nope", "failed"],
  ])("maps HTTP %i %s to '%s' → %s", async (status, reason, message, expected) => {
    const fetcher = vi.fn().mockResolvedValueOnce(apiError(status, reason, message));
    await expect(searchVideos("x", "KEY", fetcher)).rejects.toMatchObject({
      name: "YouTubeApiError",
      reason: expected,
    });
  });

  test("network errors are 'failed'", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"));
    const error = await searchVideos("x", "KEY", fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(YouTubeApiError);
    expect((error as YouTubeApiError).reason).toBe("failed");
  });
});

describe("verifyKey", () => {
  test("resolves for a working key and throws for a bad one", async () => {
    await expect(
      verifyKey("K", vi.fn().mockResolvedValueOnce(json({ items: [] }))),
    ).resolves.toBeUndefined();
    await expect(
      verifyKey("K", vi.fn().mockResolvedValueOnce(apiError(400, "keyInvalid"))),
    ).rejects.toMatchObject({ reason: "invalid_key" });
  });
});
