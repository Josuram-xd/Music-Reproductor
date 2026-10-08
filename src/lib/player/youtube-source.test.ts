import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PlaybackState, Track } from "./types";
import { YouTubeSource, type YTNamespace, type YTPlayer } from "./youtube-source";

/** Fake IFrame API: a player whose state changes the tests trigger by hand. */
class FakePlayer implements YTPlayer {
  static last: FakePlayer | null = null;
  time = 0;
  duration = 200;
  volume = 100;
  cued: string | null = null;
  playVideo = vi.fn(() => this.emitState(1));
  pauseVideo = vi.fn(() => this.emitState(2));
  destroy = vi.fn();
  /** Cue answers with CUED (5) right away unless set to false. */
  autoCue = true;

  constructor(
    readonly element: HTMLElement,
    readonly options: ConstructorParameters<YTNamespace["Player"]>[1],
  ) {
    FakePlayer.last = this;
    queueMicrotask(() => options.events.onReady({ target: this }));
  }
  cueVideoById(videoId: string) {
    this.cued = videoId;
    this.time = 0;
    if (this.autoCue) queueMicrotask(() => this.emitState(5));
  }
  seekTo(seconds: number) {
    this.time = seconds;
  }
  getCurrentTime() {
    return this.time;
  }
  getDuration() {
    return this.duration;
  }
  setVolume(volume: number) {
    this.volume = volume;
  }
  emitState(data: number) {
    this.options.events.onStateChange({ data });
  }
  emitError(data: number) {
    this.options.events.onError({ data });
  }
}

const YT = { Player: FakePlayer } as unknown as YTNamespace;
const video = (id: string, durationS = 180): Track => ({
  id: `yt:${id}`,
  source: "youtube",
  title: `Video ${id}`,
  externalId: id,
  durationS,
});

function setup() {
  const host = document.createElement("div");
  const loadApi = vi.fn(async () => YT);
  const source = new YouTubeSource({ getHost: () => host, loadApi, pollMs: 100 });
  const states: PlaybackState[] = [];
  source.on("state", (state) => states.push(state));
  return { source, host, loadApi, states, player: () => FakePlayer.last! };
}

beforeEach(() => {
  FakePlayer.last = null;
});
afterEach(() => vi.useRealTimers());

describe("YouTubeSource", () => {
  test("only plays YouTube tracks with a video id", () => {
    const { source } = setup();
    expect(source.canPlay(video("abcdefghijk"))).toBe(true);
    expect(source.canPlay({ ...video("x"), externalId: null })).toBe(false);
    expect(source.canPlay({ id: "a", source: "audio", title: "a" })).toBe(false);
  });

  test("creates one visible player inside the host and reuses it", async () => {
    const { source, host, loadApi, player } = setup();
    await source.load(video("aaaaaaaaaaa"));
    const first = player();
    expect(host.contains(first.element)).toBe(true);
    expect(first.cued).toBe("aaaaaaaaaaa");
    await source.load(video("bbbbbbbbbbb"));
    expect(player()).toBe(first);
    expect(first.cued).toBe("bbbbbbbbbbb");
    expect(loadApi).toHaveBeenCalledOnce();
  });

  test("load leaves it paused at 0 with the real duration", async () => {
    const { source, states } = setup();
    await source.load(video("aaaaaaaaaaa", 10));
    expect(source.getState()).toBe("paused");
    expect(source.getDuration()).toBe(200);
    expect(states).toEqual(["loading", "paused"]);
  });

  test("play / pause follow the player's state", async () => {
    const { source, player } = setup();
    await source.load(video("aaaaaaaaaaa"));
    await source.play();
    expect(player().playVideo).toHaveBeenCalled();
    expect(source.getState()).toBe("playing");
    source.pause();
    expect(source.getState()).toBe("paused");
  });

  test("reports the position while playing (the API has no time event)", async () => {
    const { source, player } = setup();
    await source.load(video("aaaaaaaaaaa"));
    vi.useFakeTimers();
    const times: number[] = [];
    source.on("time", ({ current }) => times.push(current));
    await source.play();
    player().time = 1.5;
    vi.advanceTimersByTime(100);
    player().time = 1.6;
    vi.advanceTimersByTime(100);
    expect(times.slice(-2)).toEqual([1.5, 1.6]);
    source.pause();
    const count = times.length;
    vi.advanceTimersByTime(1000);
    expect(times.length).toBe(count);
  });

  test("ended and buffering are mapped", async () => {
    const { source, player } = setup();
    const ended = vi.fn();
    source.on("ended", ended);
    await source.load(video("aaaaaaaaaaa"));
    await source.play();
    player().emitState(3);
    expect(source.getState()).toBe("loading");
    player().emitState(1);
    player().emitState(0);
    expect(source.getState()).toBe("ended");
    expect(ended).toHaveBeenCalledOnce();
  });

  test("seek, volume and getTime go to the player", async () => {
    const { source, player } = setup();
    source.setVolume(0.3);
    await source.load(video("aaaaaaaaaaa"));
    expect(player().volume).toBe(30);
    source.seek(500);
    expect(player().time).toBe(200);
    source.seek(42);
    expect(source.getTime()).toBe(42);
    source.setVolume(1);
    expect(player().volume).toBe(100);
  });

  test.each([
    [100, "unsupported"],
    [150, "unsupported"],
    [5, "decode"],
  ])("player error %i rejects the load as %s", async (code, expected) => {
    const { source, player } = setup();
    await source.load(video("aaaaaaaaaaa"));
    player().autoCue = false;
    const errors: string[] = [];
    source.on("error", (error) => errors.push(error.code));
    const loading = source.load(video("bbbbbbbbbbb"));
    await Promise.resolve();
    player().emitError(code);
    await expect(loading).rejects.toMatchObject({ code: expected });
    expect(errors).toEqual([expected]);
    expect(source.getState()).toBe("error");
  });

  test("a newer load wins over one still waiting to be cued", async () => {
    const { source, player } = setup();
    await source.load(video("aaaaaaaaaaa"));
    player().autoCue = false;
    const slow = source.load(video("bbbbbbbbbbb"));
    player().autoCue = true;
    await source.load(video("ccccccccccc"));
    await slow;
    expect(player().cued).toBe("ccccccccccc");
    expect(source.getState()).toBe("paused");
  });

  test("a video that never answers still loads after the timeout", async () => {
    const host = document.createElement("div");
    const source = new YouTubeSource({
      getHost: () => host,
      loadApi: async () => YT,
      cueTimeoutMs: 20,
    });
    await source.load(video("aaaaaaaaaaa"));
    FakePlayer.last!.autoCue = false;
    await source.load(video("bbbbbbbbbbb"));
    expect(source.getState()).toBe("paused");
  });

  test("if the API script fails the load is a network error", async () => {
    const source = new YouTubeSource({
      getHost: () => document.createElement("div"),
      loadApi: () => Promise.reject(new Error("blocked")),
    });
    await expect(source.load(video("aaaaaaaaaaa"))).rejects.toMatchObject({ code: "network" });
    expect(source.getState()).toBe("error");
  });

  test("destroy releases the player", async () => {
    const { source, player } = setup();
    await source.load(video("aaaaaaaaaaa"));
    source.destroy();
    expect(player().destroy).toHaveBeenCalledOnce();
  });
});
