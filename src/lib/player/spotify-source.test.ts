import { afterEach, describe, expect, test, vi } from "vitest";
import {
  type SpotifyNamespace,
  type SpotifyPlayer,
  type SpotifyPlayerState,
  SpotifySource,
} from "./spotify-source";
import type { Track } from "./types";

type Listener = (payload: never) => void;

/** Fake Web Playback SDK player: tests fire its events by hand. */
class FakePlayer implements SpotifyPlayer {
  static last: FakePlayer | null = null;
  listeners = new Map<string, Listener>();
  current: SpotifyPlayerState | null = null;
  /** What `connect()` triggers: "ready" by default, or an error event. */
  static connectWith: { event: string; payload: unknown } = {
    event: "ready",
    payload: { device_id: "dev1" },
  };
  resume = vi.fn(async () => {});
  activateElement = vi.fn(async () => {});
  pause = vi.fn(async () => {});
  seek = vi.fn(async () => {});
  setVolume = vi.fn(async () => {});
  disconnect = vi.fn();

  constructor(
    readonly options: { getOAuthToken: (cb: (t: string) => void) => void; volume: number },
  ) {
    FakePlayer.last = this;
  }
  addListener(event: string, cb: Listener): boolean {
    this.listeners.set(event, cb);
    return true;
  }
  async connect() {
    const { event, payload } = FakePlayer.connectWith;
    queueMicrotask(() => this.fire(event, payload));
    return true;
  }
  async getCurrentState() {
    return this.current;
  }
  fire(event: string, payload: unknown) {
    (this.listeners.get(event) as ((p: unknown) => void) | undefined)?.(payload);
  }
  state(uri: string, positionMs: number, paused: boolean, durationMs = 200_000) {
    this.current = {
      paused,
      position: positionMs,
      duration: durationMs,
      track_window: { current_track: { uri } },
    };
    this.fire("player_state_changed", this.current);
  }
}

const SDK = { Player: FakePlayer } as unknown as SpotifyNamespace;
const URI = "spotify:track:abc";
const track = (uri = URI): Track => ({
  id: `sp:${uri}`,
  source: "spotify",
  title: "Gatito",
  externalId: uri,
  durationS: 200,
});

function setup(status = 204) {
  const fetcher = vi.fn(async () => new Response(null, { status }));
  const source = new SpotifySource({
    getToken: async () => "TOKEN",
    loadSdk: async () => SDK,
    fetcher,
    pollMs: 100,
  });
  const errors: string[] = [];
  source.on("error", (e) => errors.push(e.code));
  return { source, fetcher, errors, player: () => FakePlayer.last! };
}

afterEach(() => {
  FakePlayer.connectWith = { event: "ready", payload: { device_id: "dev1" } };
  vi.useRealTimers();
});

describe("SpotifySource", () => {
  test("only plays Spotify track URIs", () => {
    const { source } = setup();
    expect(source.canPlay(track())).toBe(true);
    expect(source.canPlay({ ...track(), externalId: "abc" })).toBe(false);
    expect(source.canPlay({ id: "a", source: "audio", title: "a" })).toBe(false);
  });

  test("load connects the browser as a device and waits paused", async () => {
    const { source, fetcher } = setup();
    await source.load(track());
    expect(source.getState()).toBe("paused");
    expect(source.getDuration()).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("the first play asks the Web API to play the URI on this device", async () => {
    const { source, fetcher, player } = setup();
    await source.load(track());
    source.seek(30);
    await source.play();
    const [url, init] = fetcher.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://api.spotify.com/v1/me/player/play?device_id=dev1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ uris: [URI], position_ms: 30_000 });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN");

    player().state(URI, 30_000, false);
    expect(source.getState()).toBe("playing");
    await source.play();
    expect(player().resume).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  test("activates Spotify audio synchronously before waiting for playback", async () => {
    const { source, player } = setup();
    await source.load(track());
    const playback = source.play();
    expect(player().activateElement).toHaveBeenCalledOnce();
    await playback;
  });

  test("a 403 means Premium is required", async () => {
    const { source, errors } = setup(403);
    await source.load(track());
    await expect(source.play()).rejects.toMatchObject({ code: "account" });
    expect(errors).toEqual(["account"]);
    expect(source.getState()).toBe("error");
  });

  test("account errors from the SDK fail the load", async () => {
    FakePlayer.connectWith = { event: "account_error", payload: { message: "Premium only" } };
    const { source, errors } = setup();
    await expect(source.load(track())).rejects.toMatchObject({ code: "account" });
    expect(errors).toEqual(["account"]);
  });

  test("a lost device is reconnected once", async () => {
    const { source, fetcher } = setup();
    fetcher
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await source.load(track());
    await source.play();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("stopping at 0 right after the end means the track ended", async () => {
    const { source, player } = setup();
    const ended = vi.fn();
    source.on("ended", ended);
    await source.load(track());
    await source.play();
    player().state(URI, 199_000, false);
    player().state(URI, 0, true);
    expect(ended).toHaveBeenCalledOnce();
    expect(source.getState()).toBe("ended");
  });

  test("a normal pause is not an end", async () => {
    const { source, player } = setup();
    const ended = vi.fn();
    source.on("ended", ended);
    await source.load(track());
    await source.play();
    player().state(URI, 50_000, false);
    player().state(URI, 50_000, true);
    expect(ended).not.toHaveBeenCalled();
    expect(source.getState()).toBe("paused");
    expect(source.getTime()).toBe(50);
  });

  test("Spotify's autoplay moving to another track counts as the end", async () => {
    const { source, player } = setup();
    const ended = vi.fn();
    source.on("ended", ended);
    await source.load(track());
    await source.play();
    player().state("spotify:track:other", 0, false);
    expect(ended).toHaveBeenCalledOnce();
    expect(player().pause).toHaveBeenCalled();
  });

  test("polls the position while playing", async () => {
    const { source, player } = setup();
    await source.load(track());
    await source.play();
    vi.useFakeTimers();
    const times: number[] = [];
    source.on("time", ({ current }) => times.push(current));
    player().state(URI, 1_000, false);
    player().current = { ...player().current!, position: 1_500 };
    await vi.advanceTimersByTimeAsync(100);
    expect(times.at(-1)).toBe(1.5);
  });

  test("seek, pause and volume go to the SDK once started", async () => {
    const { source, player } = setup();
    source.setVolume(0.4);
    await source.load(track());
    expect(player().options.volume).toBe(0.4);
    await source.play();
    source.seek(12.3);
    expect(player().seek).toHaveBeenCalledWith(12_300);
    source.pause();
    expect(player().pause).toHaveBeenCalled();
    source.setVolume(0.8);
    expect(player().setVolume).toHaveBeenCalledWith(0.8);
  });

  test("the SDK gets its token from our server", async () => {
    const { source, player } = setup();
    await source.load(track());
    const token = await new Promise((resolve) => player().options.getOAuthToken(resolve));
    expect(token).toBe("TOKEN");
  });

  test("destroy disconnects the device", async () => {
    const { source, player } = setup();
    await source.load(track());
    source.destroy();
    expect(player().disconnect).toHaveBeenCalledOnce();
  });
});
