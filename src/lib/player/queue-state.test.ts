import { describe, expect, test } from "vitest";
import {
  MAX_QUEUE_STATE_TRACKS,
  parseQueueStatePayload,
  toQueueStatePayload,
  toQueueStateRow,
  toSavedQueue,
} from "./queue-state";
import type { Track } from "./types";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const track = (trackId: string): Track => ({ id: trackId, source: "audio", title: trackId });
const [A, B, C] = [id(1), id(2), id(3)];

describe("toQueueStatePayload", () => {
  test("keeps order, the loaded track and a rounded position", () => {
    expect(
      toQueueStatePayload({ queue: [A, B, C].map(track), current: track(B), time: 12.345 }),
    ).toEqual({ trackIds: [A, B, C], currentId: B, positionS: 12.3 });
  });

  test("skips tracks that are not in the library", () => {
    expect(
      toQueueStatePayload({ queue: [track(A), track("yt-1")], current: track("yt-1"), time: 5 }),
    ).toEqual({ trackIds: [A], currentId: null, positionS: 5 });
  });

  test("no loaded track means position 0", () => {
    expect(toQueueStatePayload({ queue: [track(A)], current: null, time: 9 })).toEqual({
      trackIds: [A],
      currentId: null,
      positionS: 0,
    });
  });
});

describe("parseQueueStatePayload", () => {
  test("accepts a valid payload", () => {
    const payload = { trackIds: [A, B], currentId: B, positionS: 3 };
    expect(parseQueueStatePayload(payload)).toEqual(payload);
    expect(parseQueueStatePayload({ trackIds: [], currentId: null, positionS: 0 })).not.toBeNull();
  });

  test.each([
    ["not an object", "hello"],
    ["ids not an array", { trackIds: "x", currentId: null, positionS: 0 }],
    ["an invalid id", { trackIds: ["nope"], currentId: null, positionS: 0 }],
    ["duplicated ids", { trackIds: [A, A], currentId: null, positionS: 0 }],
    ["a current id outside the queue", { trackIds: [A], currentId: B, positionS: 0 }],
    ["a negative position", { trackIds: [A], currentId: A, positionS: -1 }],
    ["a non-finite position", { trackIds: [A], currentId: A, positionS: Infinity }],
    [
      "too many tracks",
      {
        trackIds: Array.from({ length: MAX_QUEUE_STATE_TRACKS + 1 }, (_, i) => id(i)),
        currentId: null,
        positionS: 0,
      },
    ],
  ])("rejects %s", (_, body) => {
    expect(parseQueueStatePayload(body)).toBeNull();
  });
});

describe("toQueueStateRow", () => {
  test("stores the current track as an index", () => {
    expect(toQueueStateRow({ trackIds: [A, B], currentId: B, positionS: 7 })).toEqual({
      track_ids: [A, B],
      current_index: 1,
      position_s: 7,
    });
    expect(toQueueStateRow({ trackIds: [A], currentId: null, positionS: 7 })).toEqual({
      track_ids: [A],
      current_index: null,
      position_s: 0,
    });
  });
});

describe("toSavedQueue", () => {
  test("rebuilds the saved order", () => {
    expect(
      toSavedQueue(
        { track_ids: [C, A, B], current_index: 1, position_s: 30 },
        [A, B, C].map(track),
      ),
    ).toEqual({ tracks: [C, A, B].map(track), currentId: A, positionS: 30 });
  });

  test("skips deleted tracks", () => {
    expect(
      toSavedQueue({ track_ids: [A, B, C], current_index: 0, position_s: 30 }, [A, C].map(track)),
    ).toEqual({ tracks: [A, C].map(track), currentId: A, positionS: 30 });
  });

  test("if the loaded track was deleted it starts from the beginning", () => {
    expect(
      toSavedQueue({ track_ids: [A, B], current_index: 1, position_s: 30 }, [track(A)]),
    ).toEqual({ tracks: [track(A)], currentId: null, positionS: 0 });
  });
});
