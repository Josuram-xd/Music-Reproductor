import { beforeEach, describe, expect, test, vi } from "vitest";
import { resetSpotifyToken, spotifyAccessToken } from "./client-token";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => resetSpotifyToken());

describe("spotifyAccessToken", () => {
  test("caches the token until shortly before it expires", async () => {
    let now = 0;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ accessToken: "A", expiresAt: 3_600_000 }))
      .mockResolvedValueOnce(json({ accessToken: "B", expiresAt: 7_200_000 }));
    expect(await spotifyAccessToken(fetcher, () => now)).toBe("A");
    now = 3_000_000;
    expect(await spotifyAccessToken(fetcher, () => now)).toBe("A");
    now = 3_550_000;
    expect(await spotifyAccessToken(fetcher, () => now)).toBe("B");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("concurrent callers share one request", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ accessToken: "A", expiresAt: 9e12 }));
    await Promise.all([spotifyAccessToken(fetcher), spotifyAccessToken(fetcher)]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  test("not connected is an account error", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: "not_connected" }, 409));
    await expect(spotifyAccessToken(fetcher)).rejects.toMatchObject({ code: "account" });
  });
});
