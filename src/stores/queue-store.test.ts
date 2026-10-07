import { beforeEach, describe, expect, test, vi } from "vitest";
import { DROP_PREFERENCE_KEY, getDropPreference } from "@/lib/player/drop-preference";
import { FakeSource } from "@/lib/player/fake-source.test-utils";
import { DROP_MESSAGES, QUEUE_MESSAGES } from "@/lib/player/messages";
import { PlayerEngine } from "@/lib/player/player-engine";
import type { Track } from "@/lib/player/types";
import { queue, useQueueStore } from "./queue-store";
import { useToastStore } from "./toast-store";

// The real engine plays through <audio> and Supabase: use an in-memory source.
const engine = vi.hoisted(() => ({ current: null as PlayerEngine | null }));
vi.mock("./player-store", () => ({ getPlayer: () => engine.current! }));

const track = (id: string): Track => ({ id, source: "audio", title: `Song ${id}`, durationS: 100 });
const order = () => engine.current!.getSnapshot().queue.map((t) => t.id);
const current = () => engine.current!.getSnapshot().current?.id;
const toasts = () => useToastStore.getState().toasts;
const pending = () => useQueueStore.getState().pendingDrop;

beforeEach(async () => {
  sessionStorage.clear();
  useToastStore.setState({ toasts: [] });
  useQueueStore.setState({ pendingDrop: null, dropPreference: null });
  engine.current = new PlayerEngine({ sources: [new FakeSource("audio")] });
  queue.playList(["a", "b", "c", "d"].map(track), "b");
  await vi.waitFor(() => expect(current()).toBe("b"));
});

describe("queue store", () => {
  test("place reorders queued tracks and adds new ones with a toast", () => {
    queue.place(track("d"), "b");
    expect(order()).toEqual(["a", "b", "d", "c"]);
    expect(toasts()).toEqual([]);
    queue.place(track("x"), "b");
    expect(order()).toEqual(["a", "b", "x", "d", "c"]);
    expect(toasts().map((t) => t.message)).toEqual([QUEUE_MESSAGES.added]);
  });

  test("the current track cannot be placed", () => {
    queue.place(track("b"), "d");
    queue.dropOnCurrent(track("b"));
    expect(order()).toEqual(["a", "b", "c", "d"]);
    expect(pending()).toBeNull();
  });

  test("add puts a new track at the end with a toast", () => {
    queue.add(track("x"));
    expect(order()).toEqual(["a", "b", "c", "d", "x"]);
    expect(toasts().map((t) => t.message)).toEqual([QUEUE_MESSAGES.added]);
  });

  test("add leaves a queued track where it is and says so", () => {
    queue.add(track("a"));
    expect(order()).toEqual(["a", "b", "c", "d"]);
    expect(toasts().map((t) => t.message)).toEqual([QUEUE_MESSAGES.alreadyQueued]);
  });

  test("add to an empty queue does not start playing", () => {
    engine.current = new PlayerEngine({ sources: [new FakeSource("audio")] });
    queue.add(track("x"));
    expect(order()).toEqual(["x"]);
    expect(current()).toBeUndefined();
  });

  test("append adds at the end", () => {
    queue.append(track("x"));
    queue.append(track("a"));
    expect(order()).toEqual(["b", "c", "d", "x", "a"]);
  });

  describe("drop on the current track", () => {
    test("moves the track to position 0 and asks", () => {
      queue.dropOnCurrent(track("d"));
      expect(order()).toEqual(["a", "d", "b", "c"]);
      expect(current()).toBe("b");
      expect(pending()?.track.id).toBe("d");
    });

    test("revert restores the original position", () => {
      queue.dropOnCurrent(track("d"));
      queue.resolveDrop("revert");
      expect(order()).toEqual(["a", "b", "c", "d"]);
      expect(pending()).toBeNull();
    });

    test("revert removes a track that came from the library", () => {
      queue.dropOnCurrent(track("x"));
      expect(order()).toEqual(["a", "x", "b", "c", "d"]);
      queue.resolveDrop("revert");
      expect(order()).toEqual(["a", "b", "c", "d"]);
    });

    test("play now plays it and the cut track goes next", () => {
      queue.dropOnCurrent(track("d"));
      queue.resolveDrop("playNow");
      expect(order()).toEqual(["a", "d", "b", "c"]);
      expect(current()).toBe("d");
    });

    test("play next puts it right after the current one", () => {
      queue.dropOnCurrent(track("d"));
      queue.resolveDrop("playNext");
      expect(order()).toEqual(["a", "b", "d", "c"]);
      expect(current()).toBe("b");
    });

    test("a second drop while asking counts the first one as a mistake", () => {
      queue.dropOnCurrent(track("d"));
      queue.dropOnCurrent(track("c"));
      expect(order()).toEqual(["a", "c", "b", "d"]);
      expect(pending()?.track.id).toBe("c");
    });

    test("with nothing loaded it just plays the track", () => {
      engine.current = new PlayerEngine({ sources: [new FakeSource("audio")] });
      queue.dropOnCurrent(track("x"));
      expect(current()).toBe("x");
      expect(pending()).toBeNull();
    });
  });

  describe("don't ask again this session", () => {
    test("remembering a choice saves it in sessionStorage", () => {
      queue.dropOnCurrent(track("d"));
      queue.resolveDrop("playNext", { remember: true });
      expect(sessionStorage.getItem(DROP_PREFERENCE_KEY)).toBe("playNext");
      expect(useQueueStore.getState().dropPreference).toBe("playNext");
      expect(toasts().map((t) => t.message)).toEqual([DROP_MESSAGES.remembered]);
    });

    test("revert is never remembered", () => {
      queue.dropOnCurrent(track("d"));
      queue.resolveDrop("revert", { remember: true });
      expect(getDropPreference()).toBeNull();
    });

    test("next drops apply the choice directly with a 5 s undo toast", () => {
      vi.useFakeTimers();
      try {
        sessionStorage.setItem(DROP_PREFERENCE_KEY, "playNow");
        queue.dropOnCurrent(track("d"));
        expect(pending()).toBeNull();
        expect(current()).toBe("d");
        const [undo] = toasts();
        expect(undo?.message).toBe(DROP_MESSAGES.applied.playNow("Song d"));
        expect(undo?.action?.label).toBe(DROP_MESSAGES.undo);

        undo!.action!.run();
        expect(current()).toBe("b");
        expect(order()).toEqual(["a", "b", "c", "d"]);

        vi.advanceTimersByTime(5000);
        expect(toasts()).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });

    test("resetDropPreference asks again", () => {
      sessionStorage.setItem(DROP_PREFERENCE_KEY, "playNext");
      queue.syncPreference();
      expect(useQueueStore.getState().dropPreference).toBe("playNext");
      queue.resetDropPreference();
      expect(sessionStorage.getItem(DROP_PREFERENCE_KEY)).toBeNull();
      expect(useQueueStore.getState().dropPreference).toBeNull();
      queue.dropOnCurrent(track("d"));
      expect(pending()).not.toBeNull();
    });

    test("unknown stored values are ignored", () => {
      sessionStorage.setItem(DROP_PREFERENCE_KEY, "explode");
      expect(getDropPreference()).toBeNull();
    });
  });
});
