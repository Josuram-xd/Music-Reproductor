import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { LibraryTrack } from "@/lib/library/tracks";
import { queue } from "@/stores/queue-store";
import { useToastStore } from "@/stores/toast-store";
import { PlaylistView } from "./playlist-view";

const actions = vi.hoisted(() => ({
  deletePlaylist: vi.fn(async () => ({ ok: true as const })),
  moveInPlaylist: vi.fn(async () => ({ ok: true as const })),
  removeFromPlaylist: vi.fn(async () => ({ ok: true as const })),
  renamePlaylist: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/playlists/actions", () => actions);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/stores/player-store", async () => {
  const { create } = await import("zustand");
  return { usePlayerStore: create(() => ({ current: null, state: "idle" })) };
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

const track = (id: string, durationS: number): LibraryTrack =>
  ({
    id,
    title: `Song ${id}`,
    artist: null,
    source: "audio",
    origin: "file",
    duration_s: durationS,
    storage_path: `u/${id}.mp3`,
    external_id: null,
    cover_path: null,
    cover_url: null,
  }) as LibraryTrack;

const playlist = { id: "p1", name: "Siesta", tracks: [track("a", 120), track("b", 1500)] };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useToastStore.setState({ toasts: [] });
});

describe("PlaylistView", () => {
  test("shows name, count, length and the tracks in order", () => {
    render(<PlaylistView playlist={playlist} />);
    expect(screen.getByRole("heading", { name: "Siesta" })).toBeInTheDocument();
    expect(screen.getByText("2 canciones · 27 min")).toBeInTheDocument();
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByText(/^Song/).textContent)).toEqual([
      "Song a",
      "Song b",
    ]);
  });

  test("plays from the start or from a track, and adds it all to the queue", () => {
    const playList = vi.spyOn(queue, "playList").mockImplementation(() => {});
    const addMany = vi.spyOn(queue, "addMany").mockReturnValue(2);
    render(<PlaylistView playlist={playlist} />);

    fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
    expect(playList).toHaveBeenLastCalledWith(
      [expect.objectContaining({ id: "a" }), expect.objectContaining({ id: "b" })],
      "a",
    );
    fireEvent.click(screen.getByText("Song b"));
    expect(playList).toHaveBeenLastCalledWith(expect.any(Array), "b");

    fireEvent.click(screen.getByRole("button", { name: "Añadir a la cola" }));
    expect(addMany).toHaveBeenCalledOnce();
    expect(useToastStore.getState().toasts[0]?.message).toBe("2 canciones añadidas a la cola");
  });

  test("removing a track hides it at once and saves it", async () => {
    render(<PlaylistView playlist={playlist} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Quitar Song a de la playlist" }));
    });
    expect(actions.removeFromPlaylist).toHaveBeenCalledWith("p1", "a");
  });

  test("deleting goes back to the playlists page", async () => {
    render(<PlaylistView playlist={playlist} />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar" }));
    });
    expect(actions.deletePlaylist).toHaveBeenCalledWith("p1");
    expect(router.push).toHaveBeenCalledWith("/playlists");
  });

  test("an empty playlist explains how to fill it", () => {
    render(<PlaylistView playlist={{ ...playlist, tracks: [] }} />);
    expect(screen.getByText("Esta playlist está vacía")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproducir" })).toBeDisabled();
  });
});
