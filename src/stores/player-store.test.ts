import { afterEach, describe, expect, test, vi } from "vitest";
import { FIRST_TRACK_MESSAGE } from "@/lib/player/messages";
import { getPlayer, player, runPlayerAction, usePlayerStore } from "./player-store";
import { useToastStore } from "./toast-store";

const messages = () => useToastStore.getState().toasts.map((t) => t.message);

afterEach(() => {
  useToastStore.setState({ toasts: [] });
  vi.restoreAllMocks();
});

describe("player store", () => {
  test("getPlayer returns a single shared engine", () => {
    expect(getPlayer()).toBe(getPlayer());
  });

  test("engine changes reach the store", () => {
    getPlayer().setVolume(0.25);
    expect(usePlayerStore.getState().volume).toBe(0.25);
    getPlayer().setVolume(1);
  });

  test("⏮ on the first track shows the kawaii toast", async () => {
    await player.back();
    expect(messages()).toEqual([FIRST_TRACK_MESSAGE]);
  });

  test("changing repeat mode shows a toast", () => {
    player.cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("all");
    expect(messages()).toEqual(["Repetir: toda la cola"]);
    getPlayer().setRepeat("off");
  });

  test("keyboard actions map to the engine", () => {
    const engine = getPlayer();
    const seekBy = vi.spyOn(engine, "seekBy");
    const toggleMute = vi.spyOn(engine, "toggleMute");
    const next = vi.spyOn(engine, "next");
    const toggle = vi.spyOn(engine, "toggle");

    runPlayerAction("seekBackward");
    runPlayerAction("seekForward");
    runPlayerAction("toggleMute");
    runPlayerAction("next");
    runPlayerAction("toggle");

    expect(seekBy).toHaveBeenNthCalledWith(1, -10);
    expect(seekBy).toHaveBeenNthCalledWith(2, 10);
    expect(toggleMute).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(toggle).toHaveBeenCalledOnce();
    engine.toggleMute();
  });
});
