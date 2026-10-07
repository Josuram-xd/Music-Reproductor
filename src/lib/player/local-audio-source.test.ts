import { afterEach, describe, expect, test, vi } from "vitest";
import { LocalAudioSource } from "./local-audio-source";
import { PlaybackError, type PlaybackState, type Track } from "./types";

/** Scriptable stand-in for HTMLAudioElement (jsdom cannot play media). */
class FakeAudio extends EventTarget {
  preload = "";
  currentTime = 0;
  duration = NaN;
  volume = 1;
  paused = true;
  error: { code: number; message: string } | null = null;
  /** What happens when the page calls load(): metadata, an error, or nothing. */
  onLoad: "metadata" | "error" | "hang" = "metadata";
  /** Error thrown by play(), if any. */
  playError: unknown = null;
  private attrs = new Map<string, string>();

  set src(value: string) {
    this.attrs.set("src", value);
  }
  get src() {
    return this.attrs.get("src") ?? "";
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }

  load() {
    this.currentTime = 0;
    if (!this.src) return;
    queueMicrotask(() => {
      if (this.onLoad === "metadata") {
        this.duration = 180;
        this.fire("durationchange");
        this.fire("loadedmetadata");
      } else if (this.onLoad === "error") {
        this.error = { code: 4, message: "" };
        this.fire("error");
      }
    });
  }

  async play() {
    if (this.playError) throw this.playError;
    this.paused = false;
    this.fire("playing");
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.fire("pause");
  }

  fire(type: string) {
    this.dispatchEvent(new Event(type));
  }
}

const song: Track = { id: "t1", source: "audio", title: "Neko Lofi", storagePath: "u/t1.mp3" };

function setup(resolveUrl = vi.fn(async (track: Track) => `https://cdn/${track.id}.mp3`)) {
  const audio = new FakeAudio();
  const source = new LocalAudioSource({
    resolveUrl,
    createAudio: () => audio as unknown as HTMLAudioElement,
  });
  const states: PlaybackState[] = [];
  source.on("state", (state) => states.push(state));
  return { audio, source, states, resolveUrl };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LocalAudioSource", () => {
  test("only plays uploaded audio files", () => {
    const { source } = setup();
    expect(source.kind).toBe("audio");
    expect(source.canPlay(song)).toBe(true);
    expect(source.canPlay({ ...song, storagePath: null })).toBe(false);
    expect(source.canPlay({ ...song, source: "youtube", externalId: "abc" })).toBe(false);
  });

  test("starts idle with no time", () => {
    const { source } = setup();
    expect(source.getState()).toBe("idle");
    expect(source.getTime()).toBe(0);
    expect(source.getDuration()).toBe(0);
  });

  test("load resolves the URL and waits for metadata", async () => {
    const { audio, source, states, resolveUrl } = setup();
    const times: number[] = [];
    source.on("time", ({ duration }) => times.push(duration));

    await source.load(song);

    expect(resolveUrl).toHaveBeenCalledWith(song);
    expect(audio.src).toBe("https://cdn/t1.mp3");
    expect(source.getDuration()).toBe(180);
    expect(source.getState()).toBe("paused");
    expect(states).toEqual(["loading", "paused"]);
    expect(times.at(-1)).toBe(180);
  });

  test("load rejects tracks it cannot play", async () => {
    const { source } = setup();
    const errors: PlaybackError[] = [];
    source.on("error", (error) => errors.push(error));

    await expect(source.load({ ...song, source: "spotify" })).rejects.toMatchObject({
      code: "unsupported",
    });
    expect(source.getState()).toBe("error");
    expect(errors).toHaveLength(1);
  });

  test("load fails cleanly when the URL cannot be resolved", async () => {
    const { source } = setup(vi.fn().mockRejectedValue(new Error("offline")));
    await expect(source.load(song)).rejects.toMatchObject({ code: "network" });
    expect(source.getState()).toBe("error");
  });

  test("load fails when the file cannot be decoded", async () => {
    const { audio, source } = setup();
    audio.onLoad = "error";
    const errors: PlaybackError[] = [];
    source.on("error", (error) => errors.push(error));

    await expect(source.load(song)).rejects.toBeInstanceOf(PlaybackError);
    expect(errors[0]?.code).toBe("unsupported");
    expect(source.getState()).toBe("error");
  });

  test("a newer load wins over a slower older one", async () => {
    let releaseFirst: (url: string) => void = () => {};
    const resolveUrl = vi
      .fn<(track: Track) => Promise<string>>()
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockImplementationOnce(async () => "https://cdn/second.mp3");
    const { audio, source } = setup(resolveUrl);

    const first = source.load(song);
    await source.load({ ...song, id: "t2" });
    releaseFirst("https://cdn/first.mp3");
    await first;

    expect(audio.src).toBe("https://cdn/second.mp3");
    expect(source.getState()).toBe("paused");
  });

  test("play and pause update the state", async () => {
    const { source, states } = setup();
    await source.load(song);
    await source.play();
    expect(source.getState()).toBe("playing");
    source.pause();
    expect(source.getState()).toBe("paused");
    expect(states).toEqual(["loading", "paused", "playing", "paused"]);
  });

  test("play reports autoplay blocks as not-allowed", async () => {
    const { audio, source } = setup();
    await source.load(song);
    audio.playError = new DOMException("blocked", "NotAllowedError");
    await expect(source.play()).rejects.toMatchObject({ code: "not-allowed" });
    expect(source.getState()).toBe("error");
  });

  test("play wraps other failures", async () => {
    const { audio, source } = setup();
    await source.load(song);
    audio.playError = new Error("boom");
    await expect(source.play()).rejects.toMatchObject({ code: "unknown" });
  });

  test("seek clamps to the track length and emits time", async () => {
    const { audio, source } = setup();
    await source.load(song);
    const times: number[] = [];
    source.on("time", ({ current }) => times.push(current));

    source.seek(42);
    expect(source.getTime()).toBe(42);
    source.seek(-10);
    expect(audio.currentTime).toBe(0);
    source.seek(999);
    expect(audio.currentTime).toBe(180);
    expect(times).toEqual([42, 0, 180]);
  });

  test("ended emits once and seeking back leaves the ended state", async () => {
    const { audio, source } = setup();
    await source.load(song);
    const ended = vi.fn();
    source.on("ended", ended);

    await source.play();
    audio.fire("ended");
    expect(ended).toHaveBeenCalledOnce();
    expect(source.getState()).toBe("ended");

    source.seek(0);
    expect(source.getState()).toBe("paused");
  });

  test("buffering while playing shows loading", async () => {
    const { audio, source } = setup();
    await source.load(song);
    await source.play();
    audio.fire("waiting");
    expect(source.getState()).toBe("loading");
    audio.fire("playing");
    expect(source.getState()).toBe("playing");
  });

  test("runtime media errors are reported", async () => {
    const { audio, source } = setup();
    await source.load(song);
    const errors: PlaybackError[] = [];
    source.on("error", (error) => errors.push(error));

    audio.error = { code: 2, message: "" };
    audio.fire("error");
    expect(errors[0]?.code).toBe("network");
  });

  test("setVolume clamps between 0 and 1", () => {
    const { audio, source } = setup();
    source.setVolume(0.4);
    expect(audio.volume).toBe(0.4);
    source.setVolume(3);
    expect(audio.volume).toBe(1);
    source.setVolume(-1);
    expect(audio.volume).toBe(0);
    source.setVolume(NaN);
    expect(audio.volume).toBe(1);
  });

  test("on returns an unsubscribe function", async () => {
    const { source } = setup();
    const listener = vi.fn();
    const off = source.on("state", listener);
    off();
    await source.load(song);
    expect(listener).not.toHaveBeenCalled();
  });

  test("destroy stops playback, frees the source and drops listeners", async () => {
    const { audio, source } = setup();
    await source.load(song);
    await source.play();
    const listener = vi.fn();
    source.on("state", listener);

    source.destroy();
    expect(audio.paused).toBe(true);
    expect(audio.getAttribute("src")).toBeNull();
    expect(source.getState()).toBe("idle");

    audio.fire("playing");
    expect(listener).not.toHaveBeenCalled();
  });
});
