import { describe, expect, test, vi } from "vitest";
import { cleanClientId } from "./config";
import { authorizeUrl, exchangeCode, refreshTokens, SpotifyAuthError } from "./oauth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const NOW = 1_000_000;

describe("cleanClientId", () => {
  test("accepts 32 hex characters, trimmed and lowercased", () => {
    expect(cleanClientId(`  ${"AB".repeat(16)} `)).toBe("ab".repeat(16));
  });
  test("rejects anything else", () => {
    expect(cleanClientId("abc")).toBeNull();
    expect(cleanClientId("g".repeat(32))).toBeNull();
    expect(cleanClientId(null)).toBeNull();
  });
});

describe("authorizeUrl", () => {
  test("asks for a PKCE code with the playback scopes", () => {
    const url = new URL(
      authorizeUrl({
        clientId: "cid",
        redirectUri: "https://app.test/api/spotify/callback",
        state: "st",
        codeChallenge: "ch",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "cid",
      redirect_uri: "https://app.test/api/spotify/callback",
      state: "st",
      code_challenge_method: "S256",
      code_challenge: "ch",
    });
    expect(url.searchParams.get("scope")).toContain("streaming");
  });
});

describe("token requests", () => {
  test("exchanges the code with the verifier and no secret", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }));
    const tokens = await exchangeCode(
      { code: "c", redirectUri: "r", clientId: "cid", codeVerifier: "v" },
      fetcher,
      () => NOW,
    );
    expect(tokens).toEqual({ accessToken: "AT", refreshToken: "RT", expiresAt: NOW + 3_600_000 });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://accounts.spotify.com/api/token");
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "authorization_code",
      code: "c",
      redirect_uri: "r",
      client_id: "cid",
      code_verifier: "v",
    });
  });

  test("refresh keeps the old refresh token when none comes back", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ access_token: "AT2", expires_in: 60 }));
    const tokens = await refreshTokens({ refreshToken: "RT", clientId: "cid" }, fetcher, () => NOW);
    expect(tokens).toEqual({ accessToken: "AT2", refreshToken: null, expiresAt: NOW + 60_000 });
  });

  test.each([
    [{ error: "invalid_grant" }, "invalid_grant"],
    [{ error: "invalid_client" }, "invalid_client"],
    [{ error: "server_error" }, "failed"],
  ])("maps %o to %s", async (body, reason) => {
    const fetcher = vi.fn().mockResolvedValue(json(body, 400));
    await expect(
      refreshTokens({ refreshToken: "RT", clientId: "cid" }, fetcher),
    ).rejects.toMatchObject({ reason });
  });

  test("network failures are 'failed'", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("offline"));
    const error = await refreshTokens({ refreshToken: "RT", clientId: "c" }, fetcher).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(SpotifyAuthError);
    expect((error as SpotifyAuthError).reason).toBe("failed");
  });
});
