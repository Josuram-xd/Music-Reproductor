import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeSource } from "@/lib/player/fake-source.test-utils";
import { RADIO_MESSAGES } from "@/lib/player/messages";
import { PlayerEngine } from "@/lib/player/player-engine";
import type { Track } from "@/lib/player/types";
import {
  nextAttemptAt,
  REFILL_BACKOFF_MS,
  REFILL_COOLDOWN_MS,
  shouldRefill,
} from "@/lib/radio/refill";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { queue, useQueueStore } from "./queue-store";
import { FEEDBACK_URL, RECOMMENDATIONS_URL, radio } from "./radio";
import { useSettingsStore } from "./settings-store";
import { useToastStore } from "./toast-store";

const engine = vi.hoisted(() => ({ current: null as PlayerEngine | null }));
vi.mock("./player-store", () => ({ getPlayer: () => engine.current! }));
const actions = vi.hoisted(() => ({ updateUserSettings: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/settings/actions", () => actions);

const track = (id: string, artist = "Mochi", radioPick = false): Track => ({
  id,
  source: "audio",
  title: `Song ${id}`,
  artist,
  durationS: 100,
  ...(radioPick ? { radio: true } : {}),
});
const order = () => engine.current!.getSnapshot().queue.map((t) => t.id);
const messages = () => useToastStore.getState().toasts.map((t) => t.message);

beforeEach(async () => {
  useToastStore.setState({ toasts: [] });
  useQueueStore.setState({ pendingDrop: null, canUndo: false, canRedo: false });
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  engine.current = new PlayerEngine({ sources: [new FakeSource("audio")] });
  queue.playList([track("a"), track("b")], "a");
  await vi.waitFor(() => expect(engine.current!.getSnapshot().current?.id).toBe("a"));
});
afterEach(() => vi.restoreAllMocks());

describe("refill rules", () => {
  const base = {
    enabled: true,
    hasCurrent: true,
    upNextCount: 1,
    inFlight: false,
    notBefore: 0,
    now: 1000,
  };

  test("refills when ≤ 1 track is left", () => {
    expect(shouldRefill(base)).toBe(true);
    expect(shouldRefill({ ...base, upNextCount: 0 })).toBe(true);
    expect(shouldRefill({ ...base, upNextCount: 2 })).toBe(false);
  });

  test("not when off, idle, busy or cooling down", () => {
    expect(shouldRefill({ ...base, enabled: false })).toBe(false);
    expect(shouldRefill({ ...base, hasCurrent: false })).toBe(false);
    expect(shouldRefill({ ...base, inFlight: true })).toBe(false);
    expect(shouldRefill({ ...base, notBefore: 2000 })).toBe(false);
  });

  test("waits longer after an empty answer or an error", () => {
    expect(nextAttemptAt(0, 5)).toBe(REFILL_COOLDOWN_MS);
    expect(nextAttemptAt(0, 0)).toBe(REFILL_BACKOFF_MS);
    expect(nextAttemptAt(0, null)).toBe(REFILL_BACKOFF_MS);
  });
});

describe("radio store", () => {
  test("refill asks without the queued tracks and appends the picks with 🐾", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ tracks: [track("x", "Tama"), track("y", "Tama")] })),
      );
    expect(await radio.refill(5)).toBe(2);
    const [url, init] = fetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(RECOMMENDATIONS_URL);
    expect(JSON.parse(init.body as string)).toEqual({ count: 5, exclude: ["audio:a", "audio:b"] });
    expect(order()).toEqual(["a", "b", "x", "y"]);
    expect(engine.current!.getSnapshot().queue.at(-1)?.radio).toBe(true);
    expect(messages()).toEqual([RADIO_MESSAGES.added(2)]);
  });

  test("a failed refill throws (the filler backs off)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    await expect(radio.refill(5)).rejects.toThrow();
  });

  test("'No me gusta' removes that artist's picks and penalizes them", async () => {
    queue.addMany([track("x", "Tama", true), track("y", " tama ", true), track("z", "Neko", true)]);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    await radio.dislike(track("x", "Tama", true));
    expect(order()).toEqual(["a", "b", "z"]);
    expect(fetch).toHaveBeenCalledWith(FEEDBACK_URL, expect.objectContaining({ method: "POST" }));
    expect(messages()).toContain(RADIO_MESSAGES.disliked("Tama"));
    // One Ctrl+Z brings both back.
    queue.undo();
    expect(order()).toEqual(["a", "b", "x", "y", "z"]);
  });

  test("toggle flips the setting and says so", async () => {
    await radio.toggle();
    expect(useSettingsStore.getState().radioEnabled).toBe(false);
    expect(messages()).toEqual([RADIO_MESSAGES.off]);
  });
});

describe("queue.remove", () => {
  test("removes queued tracks but never the one playing; undo restores the order", () => {
    queue.addMany([track("c"), track("d")]);
    queue.remove(["a", "c"]);
    expect(order()).toEqual(["a", "b", "d"]);
    queue.undo();
    expect(order()).toEqual(["a", "b", "c", "d"]);
  });
});
