import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { queue } from "@/stores/queue-store";
import { useToastStore } from "@/stores/toast-store";
import { YouTubeSearchView } from "./youtube-search-view";

const actions = vi.hoisted(() => ({
  saveYouTubeVideo: vi.fn(async () => ({ ok: true, trackId: "t1", alreadySaved: false })),
}));
vi.mock("@/lib/youtube/actions", () => actions);
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
  videoId: "aaaaaaaaaaa",
  title: "Nyan Cat",
  channel: "Cats",
  durationS: 213,
  thumbnail: "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg",
};
const reply = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

async function searchFor(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en YouTube" }), {
    target: { value: text },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
  });
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});
afterEach(() => vi.restoreAllMocks());

describe("YouTubeSearchView", () => {
  test("searches through our API and lists the results", async () => {
    const fetch = reply({ results: [result], origin: "shared" });
    render(<YouTubeSearchView folders={[]} />);
    await searchFor("nyan cat");
    expect(fetch).toHaveBeenCalledWith("/api/youtube/search?q=nyan%20cat", expect.anything());
    expect(await screen.findByText("Nyan Cat")).toBeInTheDocument();
    expect(screen.getByText("Cats · 3:33")).toBeInTheDocument();
  });

  test("play and add to queue use the result as a YouTube track", async () => {
    reply({ results: [result], origin: "cache" });
    const playNow = vi.spyOn(queue, "playNow").mockImplementation(() => {});
    const add = vi.spyOn(queue, "add").mockImplementation(() => {});
    render(<YouTubeSearchView folders={[]} />);
    await searchFor("nyan");
    fireEvent.click(await screen.findByRole("button", { name: "Reproducir Nyan Cat" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir Nyan Cat a la cola" }));
    const track = expect.objectContaining({
      id: "yt:aaaaaaaaaaa",
      source: "youtube",
      externalId: "aaaaaaaaaaa",
    });
    expect(playNow).toHaveBeenCalledWith(track);
    expect(add).toHaveBeenCalledWith(track);
  });

  test("saves a result into the chosen folder", async () => {
    reply({ results: [result], origin: "cache" });
    render(<YouTubeSearchView folders={[{ id: "f1", name: "Gatitos", parent_id: null }]} />);
    await searchFor("nyan");
    fireEvent.click(
      await screen.findByRole("button", { name: "Guardar Nyan Cat en la biblioteca" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("Gatitos"));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    });
    expect(actions.saveYouTubeVideo).toHaveBeenCalledWith(result, "f1");
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]?.message).toBe("¡Nya~! Guardado en «Gatitos» 🐾"),
    );
  });

  test("explains a used-up quota", async () => {
    reply({ error: "quota_exhausted" }, 429);
    render(<YouTubeSearchView folders={[]} />);
    await searchFor("nyan");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Añade tu propia API key/);
  });

  test("warns when the user's own key failed and stale results are shown", async () => {
    reply({ results: [result], origin: "cache", stale: true, userKeyProblem: "invalid_key" });
    render(<YouTubeSearchView folders={[]} />);
    await searchFor("nyan");
    expect(await screen.findByText(/resultados guardados de antes/)).toBeInTheDocument();
    expect(useToastStore.getState().toasts[0]?.message).toMatch(/ya no funciona/);
  });

  test("results can be dragged to the queue", async () => {
    reply({ results: [result], origin: "cache" });
    render(<YouTubeSearchView folders={[]} />);
    await searchFor("nyan");
    const row = (await screen.findByText("Nyan Cat")).closest("li")!;
    expect(row).toHaveAttribute("draggable", "true");
  });
});
