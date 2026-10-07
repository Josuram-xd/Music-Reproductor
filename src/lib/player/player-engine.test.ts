import { describe, expect, test, vi } from "vitest";
import { Emitter } from "./emitter";
import { PlayerEngine, type PlayerSnapshot } from "./player-engine";
import {
  PlaybackError,
  type PlaybackEvents,
  type PlaybackSource,
  type PlaybackState,
  type Track,
  type TrackSource,
} from "./types";

/** In-memory PlaybackSource: loads instantly and lets tests drive time/end. */
class FakeSource implements PlaybackSource {
  readonly events = new Emitter<PlaybackEvents>();
  state: PlaybackState = "idle";
  time = 0;
  duration = 0;
  volume = 1;
  loaded: Track | null = null;
  playError: PlaybackError | null = null;
  loadError: PlaybackError | null = null;
  /** When set, load() waits for this promise (to test races). */
  loadGate: Promise<void> | null = null;

  constructor(readonly kind: TrackSource = "audio") {}

  canPlay(track: Track) {
    return track.source === this.kind;
  }
  async load(track: Track) {
    this.setState("loading");
    if (this.loadGate) await this.loadGate;
    if (this.loadError) {
      this.setState("error");
      this.events.emit("error", this.loadError);
      throw this.loadError;
    }
    this.loaded = track;
    this.time = 0;
    this.duration = track.durationS ?? 100;
    this.setState("paused");
  }
  async play() {
    if (this.playError) {
      this.setState("error");
      throw this.playError;
    }
    this.setState("playing");
  }
  pause() {
    if (this.state === "playing") this.setState("paused");
  }
  seek(seconds: number) {
    this.time = Math.min(Math.max(0, seconds), this.duration);
    if (this.state === "ended") this.setState("paused");
    this.events.emit("time", { current: this.time, duration: this.duration });
  }
  getTime() {
    return this.time;
  }
  getDuration() {
    return this.duration;
  }
  getState() {
    return this.state;
  }
  setVolume(volume: number) {
    this.volume = volume;
  }
  on<E extends keyof PlaybackEvents>(event: E, listener: (p: PlaybackEvents[E]) => void) {
    return this.events.on(event, listener);
  }
  destroy = vi.fn();

  /** Test helpers */
  setState(state: PlaybackState) {
    this.state = state;
    this.events.emit("state", state);
  }
  advanceTo(seconds: number) {
    this.time = seconds;
    this.events.emit("time", { current: seconds, duration: this.duration });
  }
  finish() {
    this.time = this.duration;
    this.setState("ended");
    this.events.emit("ended", undefined);
  }
}

const track = (id: string, source: TrackSource = "audio"): Track => ({
  id,
  source,
  title: `Song ${id}`,
  durationS: 100,
});

function setup(tracks = ["a", "b", "c"].map((id) => track(id))) {
  let clock = 1_000_000;
  const audio = new FakeSource("audio");
  const youtube = new FakeSource("youtube");
  const engine = new PlayerEngine({ sources: [audio, youtube], now: () => clock });
  const tick = (ms: number) => void (clock += ms);
  const current = () => engine.getSnapshot().current?.id;
  return { engine, audio, youtube, tracks, tick, current };
}

describe("PlayerEngine", () => {
  test("starts idle and empty", () => {
    const { engine } = setup();
    expect(engine.getSnapshot()).toMatchObject({
      current: null,
      queue: [],
      state: "idle",
      hasNext: false,
      hasPrevious: false,
    });
  });

  test("setQueue loads and autoplays the first track", async () => {
    const { engine, audio, tracks, current } = setup();
    await engine.setQueue(tracks);
    expect(current()).toBe("a");
    expect(audio.loaded?.id).toBe("a");
    expect(engine.getSnapshot()).toMatchObject({ state: "playing", duration: 100, hasNext: true });
    expect(engine.getSnapshot().queue.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  test("setQueue can start at a given track without autoplay and skips duplicates", async () => {
    const { engine, tracks, current } = setup();
    await engine.setQueue([...tracks, tracks[0]!], { startId: "b", autoplay: false });
    expect(current()).toBe("b");
    expect(engine.getSnapshot().state).toBe("paused");
    expect(engine.getSnapshot().queue).toHaveLength(3);
  });

  test("an empty queue stops the player", async () => {
    const { engine, tracks } = setup();
    await engine.setQueue(tracks);
    await engine.setQueue([]);
    expect(engine.getSnapshot()).toMatchObject({ current: null, state: "idle" });
  });

  test("subscribers get a new snapshot on every change", async () => {
    const { engine, tracks } = setup();
    const snapshots: PlayerSnapshot[] = [];
    engine.subscribe((s) => snapshots.push(s));
    await engine.setQueue(tracks);
    expect(snapshots.length).toBeGreaterThan(1);
    expect(snapshots.at(-1)).toBe(engine.getSnapshot());
    expect(new Set(snapshots).size).toBe(snapshots.length);
  });

  test("play, pause and toggle", async () => {
    const { engine, tracks } = setup();
    await engine.setQueue(tracks, { autoplay: false });
    await engine.play();
    expect(engine.getSnapshot().state).toBe("playing");
    engine.pause();
    expect(engine.getSnapshot().state).toBe("paused");
    await engine.toggle();
    expect(engine.getSnapshot().state).toBe("playing");
    await engine.toggle();
    expect(engine.getSnapshot().state).toBe("paused");
  });

  test("play with nothing loaded starts the queue", async () => {
    const { engine, tracks, current } = setup();
    for (const t of tracks) engine.enqueue(t);
    expect(current()).toBeUndefined();
    await engine.play();
    expect(current()).toBe("a");
    expect(engine.getSnapshot().state).toBe("playing");
  });

  test("enqueue appends and ignores duplicates", async () => {
    const { engine, tracks } = setup();
    await engine.setQueue([tracks[0]!]);
    expect(engine.enqueue(tracks[1]!)).toBe(true);
    expect(engine.enqueue(tracks[1]!)).toBe(false);
    expect(engine.getSnapshot().queue.map((t) => t.id)).toEqual(["a", "b"]);
    expect(engine.getSnapshot().hasNext).toBe(true);
  });

  test("next advances and stops at the end without repeat", async () => {
    const { engine, tracks, current } = setup();
    await engine.setQueue(tracks);
    expect(await engine.next()).toBe(true);
    expect(current()).toBe("b");
    expect(engine.getSnapshot().state).toBe("playing");
    await engine.next();
    expect(await engine.next()).toBe(false);
    expect(current()).toBe("c");
    expect(engine.getSnapshot().hasNext).toBe(false);
  });

  test("repeat all wraps around the circular queue", async () => {
    const { engine, tracks, current } = setup();
    await engine.setQueue(tracks, { startId: "c" });
    engine.setRepeat("all");
    expect(engine.getSnapshot().hasNext).toBe(true);
    await engine.next();
    expect(current()).toBe("a");
  });

  test("a finished track plays the next one on its own", async () => {
    const { engine, audio, tracks, current } = setup();
    await engine.setQueue(tracks);
    audio.finish();
    await vi.waitFor(() => expect(current()).toBe("b"));
    expect(engine.getSnapshot().state).toBe("playing");
  });

  test("the last track ending leaves the player in 'ended'", async () => {
    const { engine, audio, tracks, current } = setup();
    await engine.setQueue(tracks, { startId: "c" });
    audio.finish();
    await vi.waitFor(() => expect(engine.getSnapshot().state).toBe("ended"));
    expect(current()).toBe("c");
    // play() again restarts it
    await engine.play();
    expect(audio.time).toBe(0);
    expect(engine.getSnapshot().state).toBe("playing");
  });

  test("repeat one replays the same track", async () => {
    const { engine, audio, tracks, current } = setup();
    await engine.setQueue(tracks);
    engine.setRepeat("one");
    audio.finish();
    await vi.waitFor(() => expect(engine.getSnapshot().state).toBe("playing"));
    expect(current()).toBe("a");
    expect(audio.time).toBe(0);
  });

  test("cycleRepeat goes off → all → one → off", () => {
    const { engine } = setup();
    expect([engine.cycleRepeat(), engine.cycleRepeat(), engine.cycleRepeat()]).toEqual([
      "all",
      "one",
      "off",
    ]);
  });

  describe("double back", () => {
    test("past 3 s the first press restarts the track", async () => {
      const { engine, audio, tracks, current } = setup();
      await engine.setQueue(tracks, { startId: "b" });
      audio.advanceTo(42);
      expect(await engine.back()).toBe("restarted");
      expect(current()).toBe("b");
      expect(audio.time).toBe(0);
    });

    test("a second press within 1.5 s goes to the previous track", async () => {
      const { engine, audio, tracks, tick, current } = setup();
      await engine.setQueue(tracks);
      await engine.next();
      audio.advanceTo(42);
      await engine.back();
      audio.advanceTo(5); // still above 3 s
      tick(1_000);
      expect(await engine.back()).toBe("previous");
      expect(current()).toBe("a");
    });

    test("a slow second press restarts again", async () => {
      const { engine, audio, tracks, tick, current } = setup();
      await engine.setQueue(tracks, { startId: "b" });
      audio.advanceTo(42);
      await engine.back();
      audio.advanceTo(10);
      tick(2_000);
      expect(await engine.back()).toBe("restarted");
      expect(current()).toBe("b");
    });

    test("within the first 3 s it goes straight back", async () => {
      const { engine, audio, tracks, current } = setup();
      await engine.setQueue(tracks);
      await engine.next();
      audio.advanceTo(2);
      expect(await engine.back()).toBe("previous");
      expect(current()).toBe("a");
    });

    test("uses the history stack, not just the queue order", async () => {
      const { engine, tracks, current } = setup();
      await engine.setQueue(tracks);
      await engine.next(); // a → b
      await engine.next(); // b → c
      expect(await engine.back()).toBe("previous");
      expect(current()).toBe("b");
      expect(await engine.back()).toBe("previous");
      expect(current()).toBe("a");
    });

    test("falls back to the queue when there is no history", async () => {
      const { engine, tracks, current } = setup();
      await engine.setQueue(tracks, { startId: "c" });
      expect(engine.getSnapshot().hasPrevious).toBe(true);
      expect(await engine.back()).toBe("previous");
      expect(current()).toBe("b");
    });

    test("reports 'first' when there is nothing before", async () => {
      const { engine, tracks, current } = setup();
      await engine.setQueue(tracks);
      expect(engine.getSnapshot().hasPrevious).toBe(false);
      expect(await engine.back()).toBe("first");
      expect(current()).toBe("a");
    });

    test("with repeat all, back from the first goes to the last", async () => {
      const { engine, tracks, current } = setup();
      await engine.setQueue(tracks);
      engine.setRepeat("all");
      expect(await engine.back()).toBe("previous");
      expect(current()).toBe("c");
    });

    test("keeps the play/pause intent", async () => {
      const { engine, tracks } = setup();
      await engine.setQueue(tracks, { startId: "b", autoplay: false });
      await engine.back();
      expect(engine.getSnapshot().state).toBe("paused");
    });
  });

  test("seek and seekBy ±10 s are clamped by the source", async () => {
    const { engine, audio, tracks } = setup();
    await engine.setQueue(tracks);
    engine.seek(50);
    expect(engine.getSnapshot().time).toBe(50);
    engine.seekBy(10);
    expect(audio.time).toBe(60);
    engine.seekBy(-100);
    expect(audio.time).toBe(0);
    engine.seekBy(500);
    expect(audio.time).toBe(100);
  });

  test("volume and mute apply to every source", () => {
    const { engine, audio, youtube } = setup();
    engine.setVolume(0.3);
    expect([audio.volume, youtube.volume]).toEqual([0.3, 0.3]);
    engine.toggleMute();
    expect(engine.getSnapshot()).toMatchObject({ muted: true, volume: 0.3 });
    expect(audio.volume).toBe(0);
    engine.toggleMute();
    expect(audio.volume).toBe(0.3);
    engine.setVolume(7);
    expect(engine.getSnapshot().volume).toBe(1);
  });

  test("unmuting from volume 0 restores an audible level", () => {
    const { engine, audio } = setup();
    engine.setVolume(0);
    expect(engine.getSnapshot().muted).toBe(true);
    engine.toggleMute();
    expect(audio.volume).toBe(0.5);
  });

  test("switches sources by track type and pauses the old one", async () => {
    const { engine, audio, youtube } = setup([track("a"), track("y", "youtube")]);
    await engine.setQueue([track("a"), track("y", "youtube")]);
    expect(audio.state).toBe("playing");
    await engine.next();
    expect(audio.state).toBe("paused");
    expect(youtube.loaded?.id).toBe("y");
    expect(engine.getSnapshot().state).toBe("playing");

    // events from the inactive source are ignored
    audio.advanceTo(77);
    expect(engine.getSnapshot().time).toBe(0);
  });

  test("a track no source can play reports an error", async () => {
    const { engine } = setup();
    const errors: PlaybackError[] = [];
    engine.onError((e) => errors.push(e));
    await engine.setQueue([track("s", "spotify")]);
    expect(engine.getSnapshot().state).toBe("error");
    expect(errors[0]?.code).toBe("unsupported");
  });

  test("source errors are forwarded", async () => {
    const { engine, audio, tracks } = setup();
    const errors: PlaybackError[] = [];
    engine.onError((e) => errors.push(e));
    audio.loadError = new PlaybackError("network", "offline");
    await engine.setQueue(tracks);
    expect(engine.getSnapshot().state).toBe("error");
    expect(errors.map((e) => e.code)).toEqual(["network"]);
  });

  test("a blocked autoplay leaves the player paused, not broken", async () => {
    const { engine, audio, tracks } = setup();
    audio.playError = new PlaybackError("not-allowed", "blocked");
    await engine.setQueue(tracks);
    expect(engine.getSnapshot().state).toBe("paused");
    audio.playError = null;
    await engine.play();
    expect(engine.getSnapshot().state).toBe("playing");
  });

  test("a newer track change wins over a slow load", async () => {
    const { engine, audio, tracks, current } = setup();
    await engine.setQueue(tracks);
    let release = () => {};
    audio.loadGate = new Promise<void>((resolve) => (release = resolve));
    const slow = engine.next(); // b, stuck loading
    audio.loadGate = null;
    await engine.next(); // c
    release();
    await slow;
    expect(current()).toBe("c");
  });

  test("destroy releases every source", () => {
    const { engine, audio, youtube } = setup();
    engine.destroy();
    expect(audio.destroy).toHaveBeenCalledOnce();
    expect(youtube.destroy).toHaveBeenCalledOnce();
  });
});
