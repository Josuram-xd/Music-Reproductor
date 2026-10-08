import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { LibraryTrack } from "@/lib/library/tracks";
import { TrackList } from "./track-list";

vi.mock("@/stores/player-store", () => ({
  usePlayerStore: (selector: (state: { current: null; state: string }) => unknown) =>
    selector({ current: null, state: "idle" }),
}));

const track = (source: LibraryTrack["source"], id: string): LibraryTrack => ({
  id,
  folder_id: null,
  source,
  origin: "file",
  title: `Song ${id}`,
  artist: "Tama",
  duration_s: 120,
  storage_path: null,
  external_id: source === "audio" ? null : `${source}:${id}`,
  mime: null,
  size_bytes: null,
  cover_path: null,
  created_at: "2026-01-01T00:00:00Z",
});

describe("TrackList", () => {
  test("identifies YouTube and Spotify tracks by source", () => {
    render(<TrackList tracks={[track("youtube", "yt"), track("spotify", "sp")]} />);
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
  });

  test("offers permanent deletion when a handler is provided", () => {
    const onDelete = vi.fn();
    const song = track("spotify", "sp");
    render(<TrackList tracks={[song]} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar Song sp de la biblioteca" }));
    expect(onDelete).toHaveBeenCalledWith(song);
  });
});
