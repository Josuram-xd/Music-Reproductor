import { describe, expect, test } from "vitest";
import type { PlayerSnapshot } from "@/lib/player/player-engine";
import type { Track } from "@/lib/player/types";
import { parsePlayEvent, PlayTracker } from "./play-tracker";

const UUID_A = "00000000-0000-4000-8000-00000000000a";
const song: Track = { id: UUID_A, source: "audio", title: "Neko Lofi", artist: "Mochi" };
const video: Track = {
  id: "yt:aaaaaaaaaaa",
  source: "youtube",
  title: "Nyan",
  externalId: "aaaaaaaaaaa",
  radio: true,
};

type Snap = Pick<PlayerSnapshot, "current" | "state" | "time" | "duration">;
const snap = (current: Track | null, time: number, state: Snap["state"] = "playing"): Snap => ({
  current,
  state,
  time,
  duration: 100,
});

/** Plays `track` from 0 to `until` in 0.25 s ticks. */
function play(tracker: PlayTracker, track: Track, until: number, from = 0) {
  tracker.update(snap(track, from, "loading"), 0);
  for (let t = from; t <= until; t += 0.25) tracker.update(snap(track, t), 0);
}

describe("PlayTracker", () => {
  test("a completed track", () => {
    const tracker = new PlayTracker();
    play(tracker, song, 100);
    tracker.update(snap(song, 100, "ended"), 0);
    const event = tracker.update(snap(video, 0, "loading"), 1000);
    expect(event).toMatchObject({
      trackId: UUID_A,
      source: "audio",
      title: "Neko Lofi",
      artist: "Mochi",
      completed: true,
      skipped: false,
      fromRadio: false,
    });
    expect(event!.listenedS).toBeCloseTo(100, 0);
  });

  test("leaving in the first 30 s is a skip", () => {
    const tracker = new PlayTracker();
    play(tracker, song, 12);
    const event = tracker.update(snap(video, 0, "loading"), 0);
    expect(event).toMatchObject({ completed: false, skipped: true });
    expect(event!.listenedS).toBeCloseTo(12, 0);
  });

  test("listening past 30 s without finishing is neither", () => {
    const tracker = new PlayTracker();
    play(tracker, song, 45);
    expect(tracker.update(snap(null, 0, "idle"), 0)).toMatchObject({
      completed: false,
      skipped: false,
    });
  });

  test("seeks do not count as listened time", () => {
    const tracker = new PlayTracker();
    play(tracker, song, 5);
    tracker.update(snap(song, 95), 0); // jump near the end
    play(tracker, song, 100, 95);
    const event = tracker.update(snap(null, 0, "idle"), 0);
    expect(event!.listenedS).toBeCloseTo(10, 0);
    expect(event!.completed).toBe(true); // reached the end
  });

  test("paused time does not count", () => {
    const tracker = new PlayTracker();
    play(tracker, song, 40);
    tracker.update(snap(song, 40, "paused"), 0);
    tracker.update(snap(song, 41, "paused"), 0);
    tracker.update(snap(song, 42, "paused"), 0);
    expect(tracker.flush()!.listenedS).toBeCloseTo(40, 0);
  });

  test("YouTube results keep the external id and the radio flag", () => {
    const tracker = new PlayTracker();
    play(tracker, video, 40);
    expect(tracker.flush()).toMatchObject({
      trackId: null,
      source: "youtube",
      externalId: "aaaaaaaaaaa",
      fromRadio: true,
    });
  });

  test("closing the tab is not a skip", () => {
    const tracker = new PlayTracker();
    play(tracker, song, 5);
    expect(tracker.flush()).toMatchObject({ skipped: false });
    expect(tracker.flush()).toBeNull();
  });

  test("a restored track that never played records nothing", () => {
    const tracker = new PlayTracker();
    tracker.update(snap(song, 30, "paused"), 0);
    expect(tracker.update(snap(video, 0, "loading"), 0)).toBeNull();
  });

  test("repeat one: each loop is its own play", () => {
    const tracker = new PlayTracker();
    play(tracker, song, 100);
    tracker.update(snap(song, 100, "ended"), 0);
    expect(tracker.update(snap(song, 0), 0)).toMatchObject({ completed: true });
  });
});

describe("parsePlayEvent", () => {
  const NOW = Date.parse("2026-10-07T12:00:00Z");
  const valid = {
    trackId: UUID_A,
    source: "audio",
    externalId: null,
    title: " Neko Lofi ",
    artist: "Mochi",
    startedAt: "2026-10-07T11:55:00Z",
    listenedS: 120,
    completed: true,
    skipped: false,
    fromRadio: false,
  };

  test("accepts and cleans a valid event", () => {
    expect(parsePlayEvent(valid, NOW)).toMatchObject({
      trackId: UUID_A,
      title: "Neko Lofi",
      startedAt: "2026-10-07T11:55:00.000Z",
      completed: true,
    });
  });

  test("bad track ids, future or old dates and contradictions are fixed", () => {
    const event = parsePlayEvent(
      { ...valid, trackId: "nope", startedAt: "2030-01-01T00:00:00Z", skipped: true },
      NOW,
    )!;
    expect(event.trackId).toBeNull();
    expect(event.startedAt).toBe(new Date(NOW).toISOString());
    expect(event.skipped).toBe(false); // completed wins
  });

  test.each([
    ["no title", { ...valid, title: "  " }],
    ["unknown source", { ...valid, source: "vinyl" }],
    ["negative time", { ...valid, listenedS: -1 }],
    ["absurd time", { ...valid, listenedS: 1e9 }],
    ["not an object", "x"],
  ])("rejects %s", (_, body) => {
    expect(parsePlayEvent(body, NOW)).toBeNull();
  });
});
