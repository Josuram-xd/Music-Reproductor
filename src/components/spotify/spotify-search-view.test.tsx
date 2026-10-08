import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { queue } from "@/stores/queue-store";
import { SpotifySearchView } from "./spotify-search-view";

vi.mock("@/stores/player-store", async () => {
  const { create } = await import("zustand");
  return { usePlayerStore: create(() => ({ current: null })) };
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
});
