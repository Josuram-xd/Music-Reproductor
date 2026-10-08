import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Track } from "@/lib/player/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { usePlayerStore } from "@/stores/player-store";
import { queue } from "@/stores/queue-store";
import { radio } from "@/stores/radio";
import { useSettingsStore } from "@/stores/settings-store";
import { RadioSetting } from "../settings/radio-setting";
import { QueueBoard } from "./queue-board";
import { RadioFiller } from "./radio-filler";
import { RadioToggle } from "./radio-toggle";

vi.mock("@/lib/settings/actions", () => ({
  updateUserSettings: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/stores/player-store", async () => {
  const { create } = await import("zustand");
  return { usePlayerStore: create(() => ({ current: null, queue: [] })), getPlayer: vi.fn() };
});

const track = (id: string, radioPick = false): Track => ({
  id,
  source: "audio",
  title: `Song ${id}`,
  artist: "Tama",
  ...(radioPick ? { radio: true } : {}),
});

beforeEach(() => {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  act(() => usePlayerStore.setState({ current: null, queue: [] }));
});
afterEach(() => vi.restoreAllMocks());

describe("radio in the queue", () => {
  test("recommendations show 🐾 and can be removed or disliked", () => {
    const remove = vi.spyOn(queue, "remove").mockImplementation(() => {});
    const dislike = vi.spyOn(radio, "dislike").mockResolvedValue();
    const picks = [track("a"), track("b", true)];
    act(() => usePlayerStore.setState({ current: picks[0], queue: picks }));
    render(<QueueBoard />);
    expect(screen.getByText(/Recomendada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar Song b de la cola" }));
    fireEvent.click(screen.getByRole("button", { name: "No me gusta: Tama" }));
    expect(remove).toHaveBeenCalledWith(["b"]);
    expect(dislike).toHaveBeenCalledWith(picks[1]);
  });

  test("your own tracks have no radio buttons", () => {
    act(() => usePlayerStore.setState({ current: track("a"), queue: [track("a"), track("b")] }));
    render(<QueueBoard />);
    expect(screen.queryByText(/Recomendada/)).toBeNull();
    expect(screen.queryByRole("button", { name: /No me gusta/ })).toBeNull();
  });
});

describe("RadioFiller", () => {
  test("refills when one track is left and the radio is on", async () => {
    const refill = vi.spyOn(radio, "refill").mockResolvedValue(5);
    render(<RadioFiller />);
    expect(refill).not.toHaveBeenCalled(); // nothing loaded
    await act(async () => {
      usePlayerStore.setState({ current: track("a"), queue: [track("a"), track("b")] });
    });
    expect(refill).toHaveBeenCalledOnce();
    // Cooling down: more changes do not ask again right away.
    await act(async () => {
      usePlayerStore.setState({ current: track("b"), queue: [track("a"), track("b")] });
    });
    expect(refill).toHaveBeenCalledOnce();
  });

  test("does nothing with the radio off", async () => {
    const refill = vi.spyOn(radio, "refill").mockResolvedValue(5);
    useSettingsStore.setState({ radioEnabled: false });
    render(<RadioFiller />);
    await act(async () => {
      usePlayerStore.setState({ current: track("a"), queue: [track("a")] });
    });
    expect(refill).not.toHaveBeenCalled();
  });
});

describe("radio toggles", () => {
  test("queue header button reflects and flips the setting", () => {
    const toggle = vi.spyOn(radio, "toggle").mockResolvedValue();
    render(<RadioToggle />);
    const button = screen.getByRole("button", { name: "Radio neko" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledOnce();
  });

  test("Ajustes switch", async () => {
    render(<RadioSetting />);
    const toggle = screen.getByRole("switch", { name: /Radio neko/ });
    expect(toggle).toBeChecked();
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(useSettingsStore.getState().radioEnabled).toBe(false);
  });
});
