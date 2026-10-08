import { render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Emitter } from "@/lib/player/emitter";
import type { PlayerSnapshot } from "@/lib/player/player-engine";
import { PLAY_EVENTS_URL, PlayEventLogger } from "./play-event-logger";

const engine = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/stores/player-store", () => ({ getPlayer: () => engine.value }));

function fakeEngine() {
  const events = new Emitter<{ change: PlayerSnapshot }>();
  let snapshot = {
    current: null,
    state: "idle",
    time: 0,
    duration: 0,
  } as unknown as PlayerSnapshot;
  engine.value = {
    getSnapshot: () => snapshot,
    subscribe: (cb: (s: PlayerSnapshot) => void) => events.on("change", cb),
  };
  return (patch: Partial<PlayerSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    events.emit("change", snapshot);
  };
}

afterEach(() => vi.restoreAllMocks());

describe("PlayEventLogger", () => {
  test("posts a play when the track changes, with keepalive", () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    const emit = fakeEngine();
    render(<PlayEventLogger />);

    const track = { id: "t1", source: "audio" as const, title: "Neko" };
    emit({ current: track, state: "playing", time: 0, duration: 100 });
    for (let t = 0.25; t <= 10; t += 0.25) emit({ time: t });
    emit({ current: null, state: "idle", time: 0 });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(PLAY_EVENTS_URL);
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toMatchObject({ title: "Neko", skipped: true });
  });

  test("closing the page sends the play in progress", () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    const emit = fakeEngine();
    render(<PlayEventLogger />);
    emit({ current: { id: "t1", source: "audio", title: "Neko" }, state: "playing", time: 0 });
    for (let t = 0.25; t <= 40; t += 0.25) emit({ time: t });
    window.dispatchEvent(new Event("pagehide"));
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toMatchObject({ skipped: false });
  });
});
