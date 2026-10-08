import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { queue } from "@/stores/queue-store";
import { useToastStore } from "@/stores/toast-store";
import { SpotifySearchView } from "./spotify-search-view";

const actions = vi.hoisted(() => ({
  saveSpotifyTrack: vi.fn(async () => ({ ok: true, trackId: "t1", alreadySaved: false })),
}));
vi.mock("@/lib/spotify/actions", () => actions);
vi.mock("@/stores/player-store", async () => {
  const { create } = await import("zustand");
  return { usePlayerStore: create(() => ({ current: null })) };
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

const result = {
  uri: "spotify:track:abc",
  id: "abc",
  title: "Gatito",
  artists: "Ana",
  album: "Miau",
  durationS: 185,
  image: null,
};
const reply = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

async function searchFor(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en Spotify" }), {
    target: { value: text },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  });
}

afterEach(() => vi.restoreAllMocks());

describe("SpotifySearchView", () => {
  test("searches and plays or queues results as Spotify tracks", async () => {
    const fetch = reply({ results: [result] });
    const playNow = vi.spyOn(queue, "playNow").mockImplementation(() => {});
    const add = vi.spyOn(queue, "add").mockImplementation(() => {});
    render(<SpotifySearchView premium />);
    await searchFor("gatito");
    expect(fetch).toHaveBeenCalledWith("/api/spotify/search?q=gatito", expect.anything());
    expect(await screen.findByText("Ana · Miau")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reproducir Gatito" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir Gatito a la cola" }));
    const track = expect.objectContaining({
      id: "sp:abc",
      source: "spotify",
      externalId: "spotify:track:abc",
    });
    expect(playNow).toHaveBeenCalledWith(track);
    expect(add).toHaveBeenCalledWith(track);
  });

  test("saves a result to the selected library folder", async () => {
    useToastStore.setState({ toasts: [] });
    reply({ results: [result] });
    render(
      <SpotifySearchView premium folders={[{ id: "f1", name: "Gatitos", parent_id: null }]} />,
    );
    await searchFor("gatito");
    fireEvent.click(await screen.findByRole("button", { name: "Guardar Gatito en la biblioteca" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("Gatitos"));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    });
    expect(actions.saveSpotifyTrack).toHaveBeenCalledWith(result, "f1");
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]?.message).toBe("¡Nya~! Guardado en «Gatitos»"),
    );
  });

  test("not Premium: warns that it will not play here", () => {
    render(<SpotifySearchView premium={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/no es Premium/);
  });

  test("explains a forbidden account (development-mode allowlist)", async () => {
    reply({ error: "forbidden" }, 403);
    render(<SpotifySearchView premium />);
    await searchFor("gatito");
    expect(await screen.findByRole("alert")).toHaveTextContent(/User Management/);
  });

  test("explains a Spotify Web API configuration error", async () => {
    reply({ error: "spotify_api_error_400" }, 502);
    render(<SpotifySearchView premium />);
    await searchFor("gatito");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Web API/);
  });

  test("distinguishes a network failure from a Spotify API rejection", async () => {
    reply({ error: "spotify_api_network_error" }, 502);
    render(<SpotifySearchView premium />);
    await searchFor("gatito");
    expect(await screen.findByRole("alert")).toHaveTextContent(/API de Spotify/);
  });
});
