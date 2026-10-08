import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { useToastStore } from "@/stores/toast-store";
import { AddToPlaylistDialog } from "./add-to-playlist-dialog";

const actions = vi.hoisted(() => ({
  addToPlaylist: vi.fn(async () => ({ ok: true as const, added: 1 })),
  createPlaylist: vi.fn(async () => ({ ok: true as const, added: 1 })),
}));
vi.mock("@/lib/playlists/actions", () => actions);

// jsdom does not implement the modal dialog API.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

const track = { id: "t1", title: "Canción gatuna" };
const playlists = [
  { id: "p1", name: "Para estudiar" },
  { id: "p2", name: "Siesta" },
];
const messages = () => useToastStore.getState().toasts.map((t) => t.message);

beforeEach(() => {
  vi.clearAllMocks();
  useToastStore.setState({ toasts: [] });
});

describe("AddToPlaylistDialog", () => {
  test("lists the playlists and adds the track to the chosen one", async () => {
    const onClose = vi.fn();
    render(<AddToPlaylistDialog track={track} playlists={playlists} onClose={onClose} />);
    expect(screen.getByText("Canción gatuna")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siesta" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.addToPlaylist).toHaveBeenCalledWith("p2", ["t1"]);
    expect(messages()).toEqual(["Canción añadida a «Siesta» 🐾"]);
  });

  test("says when the track was already there", async () => {
    actions.addToPlaylist.mockResolvedValueOnce({ ok: true, added: 0 });
    render(<AddToPlaylistDialog track={track} playlists={playlists} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Para estudiar" }));
    await waitFor(() => expect(messages()).toEqual(["Ya estaba en «Para estudiar», nya~"]));
  });

  test("errors keep the dialog open", async () => {
    actions.addToPlaylist.mockResolvedValueOnce({ ok: false, error: "not_found" } as never);
    const onClose = vi.fn();
    render(<AddToPlaylistDialog track={track} playlists={playlists} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Siesta" }));
    await waitFor(() => expect(useToastStore.getState().toasts[0]?.tone).toBe("error"));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("can create a new playlist that starts with the track", async () => {
    const onClose = vi.fn();
    render(<AddToPlaylistDialog track={track} playlists={[]} onClose={onClose} />);
    expect(screen.getByText(/Aún no tienes playlists/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nueva playlist…" }));
    expect(screen.getByText("Empezará con «Canción gatuna».")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  Mañanas  " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Crear" }));
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.createPlaylist).toHaveBeenCalledWith(expect.any(String), "Mañanas", ["t1"]);
  });

  test("an empty name is not submitted", () => {
    render(<AddToPlaylistDialog track={track} playlists={[]} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Nueva playlist…" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));
    expect(screen.getByText(/Ponle un nombre/)).toBeInTheDocument();
    expect(actions.createPlaylist).not.toHaveBeenCalled();
  });
});
