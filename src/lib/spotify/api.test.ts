import { describe, expect, test, vi } from "vitest";
import { getProfile, searchTracks, SpotifyApiError } from "./api";
import { spotifyResultToTrack } from "./tracks";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Spotify Web API", () => {
  test("search maps tracks and picks a small image", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        tracks: {
          items: [
            {
              id: "abc",
              uri: "spotify:track:abc",
              name: "Gatito",
              duration_ms: 185_400,
              artists: [{ name: "Ana" }, { name: "Bea" }],
              album: {
                name: "Miau",
                images: [
                  { url: "big", width: 640 },
                  { url: "mid", width: 300 },
                  { url: "tiny", width: 64 },
                ],
              },
            },
            null,
            { id: "no-uri" },
          ],
        },
      }),
    );
    const results = await searchTracks("gatito", "TOKEN", fetcher);
    expect(results).toEqual([
      {
        uri: "spotify:track:abc",
        id: "abc",
        title: "Gatito",
        artists: "Ana, Bea",
        album: "Miau",
        durationS: 185,
        image: "mid",
      },
    ]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(new URL(url as string).searchParams.get("type")).toBe("track");
    expect(init.headers).toEqual({ Authorization: "Bearer TOKEN" });
  });

  test("a result becomes a Spotify track", async () => {
    expect(
      spotifyResultToTrack({
        uri: "spotify:track:abc",
        id: "abc",
        title: "Gatito",
        artists: "Ana",
        album: "",
        durationS: 185,
        image: null,
      }),
    ).toEqual({
      id: "sp:abc",
      source: "spotify",
      title: "Gatito",
      artist: "Ana",
      durationS: 185,
      externalId: "spotify:track:abc",
    });
  });

  test("profile says whether the account is Premium", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ display_name: "Neko", product: "free" }));
    expect(await getProfile("T", fetcher)).toEqual({ name: "Neko", product: "free" });
  });

  test("errors keep the HTTP status", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { message: "Forbidden" } }, 403));
    await expect(searchTracks("x", "T", fetcher)).rejects.toEqual(
      new SpotifyApiError(403, "Forbidden"),
    );
  });
});
