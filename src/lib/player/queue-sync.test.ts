import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Emitter } from "./emitter";
import type { PlayerSnapshot } from "./player-engine";
import type { SavedQueue } from "./queue-state";
import { createQueueSync } from "./queue-sync";
import type { Track } from "./types";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const track = (n: number): Track => ({ id: id(n), source: "audio", title: `Song ${n}` });

function setup(saved: SavedQueue | null = null) {
  const events = new Emitter<{ change: PlayerSnapshot }>();
  let snapshot = {
    current: null,
    queue: [],
    state: "idle",
    time: 0,
  } as unknown as PlayerSnapshot;
  const update = (patch: Partial<PlayerSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    events.emit("change", snapshot);
  };
  const save = vi.fn(async () => {});
  const restore = vi.fn(async ({ tracks, currentId, positionS }: SavedQueue) => {
    snapshot = {
      ...snapshot,
      queue: tracks,
      current: tracks.find((t) => t.id === currentId) ?? null,
      state: "paused",
      time: positionS,
    };
  });
  const sync = createQueueSync({
    getSnapshot: () => snapshot,
    subscribe: (listener) => events.on("change", listener),
    load: vi.fn(async () => saved),
    restore,
    save,
    debounceMs: 1000,
  });
  return { sync, update, save, restore };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createQueueSync", () => {
  test("restores the saved queue and does not save it straight back", async () => {
    const saved = { tracks: [track(1), track(2)], currentId: id(2), positionS: 30 };
    const { sync, restore, save } = setup(saved);
    await sync.start();
    expect(restore).toHaveBeenCalledWith(saved);
    sync.flush();
    expect(save).not.toHaveBeenCalled();
  });

  test("does not restore an empty saved queue", async () => {
    const { sync, restore } = setup({ tracks: [], currentId: null, positionS: 0 });
    await sync.start();
    expect(restore).not.toHaveBeenCalled();
  });

  test("saves queue changes after a quiet moment, once per burst", async () => {
    const { sync, update, save } = setup();
    await sync.start();
    update({ queue: [track(1)] });
    update({ queue: [track(1), track(2)] });
    vi.advanceTimersByTime(999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(
      { trackIds: [id(1), id(2)], currentId: null, positionS: 0 },
      { keepalive: false },
    );
  });

  test("time ticks alone do not save, but pausing does", async () => {
    const { sync, update, save } = setup();
    await sync.start();
    update({ queue: [track(1)], current: track(1), state: "playing" });
    vi.advanceTimersByTime(1000);
    save.mockClear();

    update({ time: 10 });
    update({ time: 11 });
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();

    update({ state: "paused" });
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledWith(
      { trackIds: [id(1)], currentId: id(1), positionS: 11 },
      { keepalive: false },
    );
  });

  test("flush saves right away with keepalive and skips duplicates", async () => {
    const { sync, update, save } = setup();
    await sync.start();
    update({ queue: [track(1)] });
    sync.flush({ keepalive: true });
    sync.flush({ keepalive: true });
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(expect.anything(), { keepalive: true });
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledOnce();
  });

  test("a failed save is retried on the next flush", async () => {
    const { sync, update, save } = setup();
    await sync.start();
    save.mockRejectedValueOnce(new Error("offline"));
    update({ queue: [track(1)] });
    sync.flush();
    await Promise.resolve();
    await Promise.resolve();
    sync.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });

  test("nothing is saved before the restore finishes or after stop", async () => {
    const { sync, update, save } = setup();
    sync.flush();
    update({ queue: [track(1)] });
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();

    await sync.start();
    sync.stop();
    update({ queue: [track(2)] });
    sync.flush();
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();
  });

  test("with nothing saved it syncs from the first change", async () => {
    const { sync, update, save } = setup();
    await sync.start();
    update({ queue: [track(1)] });
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledOnce();
  });
});
