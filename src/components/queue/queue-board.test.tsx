import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Track } from "@/lib/player/types";
import { usePlayerStore } from "@/stores/player-store";
import { queue } from "@/stores/queue-store";
import { QueueBoard, upNextOf } from "./queue-board";

vi.mock("@/lib/settings/actions", () => ({ updateUserSettings: vi.fn() }));
vi.mock("@/stores/player-store", async () => {
  const { create } = await import("zustand");
  return { usePlayerStore: create(() => ({ current: null, queue: [] })) };
});

const track = (id: string): Track => ({ id, source: "audio", title: `Song ${id}`, durationS: 65 });
const tracks = ["a", "b", "c"].map(track);

beforeEach(() => {
  vi.restoreAllMocks();
  act(() => usePlayerStore.setState({ current: null, queue: [] }));
});

describe("upNextOf", () => {
  test("is what follows the current track", () => {
    expect(upNextOf(tracks, "a").map((t) => t.id)).toEqual(["b", "c"]);
    expect(upNextOf(tracks, "c")).toEqual([]);
  });

  test("is the whole queue when nothing is loaded", () => {
    expect(upNextOf(tracks, undefined)).toEqual(tracks);
  });
});

describe("QueueBoard", () => {
  test("shows the empty state", () => {
    render(<QueueBoard />);
    expect(screen.getByText("La cola está vacía")).toBeInTheDocument();
  });

  test("lists up next with drag handles", () => {
    act(() => usePlayerStore.setState({ current: tracks[0], queue: tracks }));
    render(<QueueBoard />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("A continuación · 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reordenar Song b" })).toBeInTheDocument();
    expect(within(list).getAllByText("1:05")).toHaveLength(2);
  });

  test("clicking a row plays it", () => {
    const playQueued = vi.spyOn(queue, "playQueued").mockImplementation(() => {});
    act(() => usePlayerStore.setState({ current: tracks[0], queue: tracks }));
    render(<QueueBoard />);
    fireEvent.click(screen.getByText("Song c"));
    expect(playQueued).toHaveBeenCalledWith("c");
  });

  test("with a current track but nothing after it, invites to drag more", () => {
    act(() => usePlayerStore.setState({ current: tracks[2], queue: tracks }));
    render(<QueueBoard />);
    expect(screen.getByText(/No hay nada a continuación/)).toBeInTheDocument();
  });
});
