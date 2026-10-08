import { describe, expect, test, vi } from "vitest";
import { SpotifyAuthError } from "./oauth";
import { getAccessToken, REFRESH_MARGIN_MS, type StoredSpotify, type TokenDeps } from "./tokens";

const NOW = 10_000_000;
const stored = (overrides: Partial<StoredSpotify> = {}): StoredSpotify => ({
  clientId: "mine",
  accessToken: "AT",
  refreshToken: "RT",
  expiresAt: NOW + 30 * 60_000,
  ...overrides,
});

function deps(overrides: Partial<TokenDeps> = {}): TokenDeps {
  return {
    load: vi.fn(async () => stored()),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    serverClientId: null,
    refresh: vi.fn(async () => ({
      accessToken: "NEW",
      refreshToken: "RT2",
      expiresAt: NOW + 3_600_000,
    })),
    now: () => NOW,
    ...overrides,
  };
}

describe("getAccessToken", () => {
  test("not connected without a refresh token or a Client ID", async () => {
    expect(await getAccessToken(deps({ load: async () => null }))).toEqual({
      ok: false,
      error: "not_connected",
    });
    expect(await getAccessToken(deps({ load: async () => stored({ clientId: null }) }))).toEqual({
      ok: false,
      error: "not_connected",
    });
  });

  test("a valid token is reused without calling Spotify", async () => {
    const d = deps();
    expect(await getAccessToken(d)).toEqual({
      ok: true,
      accessToken: "AT",
      expiresAt: NOW + 30 * 60_000,
    });
    expect(d.refresh).not.toHaveBeenCalled();
  });

  test("a token about to expire is refreshed and saved", async () => {
    const d = deps({ load: async () => stored({ expiresAt: NOW + REFRESH_MARGIN_MS - 1 }) });
    expect(await getAccessToken(d)).toMatchObject({ ok: true, accessToken: "NEW" });
    expect(d.refresh).toHaveBeenCalledWith({ refreshToken: "RT", clientId: "mine" });
    expect(d.save).toHaveBeenCalledOnce();
  });

  test("the owner refreshes with the server's Client ID", async () => {
    const d = deps({
      load: async () => stored({ clientId: null, accessToken: null }),
      serverClientId: "server",
    });
    await getAccessToken(d);
    expect(d.refresh).toHaveBeenCalledWith({ refreshToken: "RT", clientId: "server" });
  });

  test("a revoked refresh token asks to connect again", async () => {
    const d = deps({
      load: async () => stored({ accessToken: null }),
      refresh: vi.fn().mockRejectedValue(new SpotifyAuthError("invalid_grant", "revoked")),
    });
    expect(await getAccessToken(d)).toEqual({ ok: false, error: "reauth" });
    expect(d.clear).toHaveBeenCalledOnce();
  });

  test("a parallel refresh that rotated the token is not mistaken for a revoke", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(stored({ accessToken: null }))
      .mockResolvedValueOnce(stored({ refreshToken: "RT2", accessToken: "FROM_OTHER" }));
    const d = deps({
      load,
      refresh: vi.fn().mockRejectedValue(new SpotifyAuthError("invalid_grant", "rotated")),
    });
    expect(await getAccessToken(d)).toMatchObject({ ok: true, accessToken: "FROM_OTHER" });
    expect(d.clear).not.toHaveBeenCalled();
  });

  test("network failures keep the connection", async () => {
    const d = deps({
      load: async () => stored({ accessToken: null }),
      refresh: vi.fn().mockRejectedValue(new SpotifyAuthError("failed", "offline")),
    });
    expect(await getAccessToken(d)).toEqual({ ok: false, error: "failed" });
    expect(d.clear).not.toHaveBeenCalled();
  });
});
