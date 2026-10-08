import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { type StatsDetails as Details, toHeatmap } from "@/lib/stats/details";
import { StatsDetails } from "./stats-details";

const actions = vi.hoisted(() => ({ deleteHistory: vi.fn(async () => ({ ok: true as const })) }));
vi.mock("@/lib/stats/actions", () => actions);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

const details: Details = {
  tracks: [
    { key: "t1", label: "Neko Lofi", sublabel: "Mochi", value: 3600, plays: 12 },
    { key: "t2", label: "Gatito", sublabel: null, value: 900, plays: 3 },
  ],
  artists: [{ key: "mochi", label: "Mochi", sublabel: null, value: 3600, plays: 12 }],
  folders: [],
  skipped: [{ key: "t3", label: "Ruido", sublabel: null, value: 4, plays: 5 }],
  heatmap: toHeatmap([{ weekday: 1, hour: 21, listened_s: 600 }]),
  bySource: { audio: 300, youtube: 100, spotify: 0 },
};
const reply = (body: unknown, status = 200) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe("StatsDetails", () => {
  test("shows tops, heatmap, sources and skips for the month by default", async () => {
    const fetch = reply(details);
    render(<StatsDetails />);
    expect(await screen.findByText("Neko Lofi")).toBeInTheDocument();
    const url = new URL(String(fetch.mock.calls[0]![0]), "http://x");
    expect(url.pathname).toBe("/api/stats/details");
    expect(url.searchParams.get("period")).toBe("month");
    expect(url.searchParams.get("top")).toBe("5");
    expect(url.searchParams.get("tz")).toBeTruthy();

    expect(screen.getAllByText("1 h 00 min")).toHaveLength(2); // top song and top artist
    expect(screen.getByText(/Escucha canciones de tus carpetas/)).toBeInTheDocument();
    expect(screen.getByText("4 saltos")).toBeInTheDocument();
    expect(screen.getByRole("figure")).toHaveTextContent("Tu hora favorita: martes a las 21:00");
    expect(screen.getByText("5 min · 75 %")).toBeInTheDocument();
    // Accessible table alternative for the heatmap.
    expect(screen.getByRole("table")).toHaveTextContent("21:00: 10 min");
  });

  test("changing the period or the top size asks again", async () => {
    const fetch = reply(details);
    render(<StatsDetails />);
    await screen.findByText("Neko Lofi");
    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    await waitFor(() => expect(String(fetch.mock.calls.at(-1)![0])).toContain("period=week"));
    fireEvent.click(screen.getByRole("button", { name: "Top 10" }));
    await waitFor(() => expect(String(fetch.mock.calls.at(-1)![0])).toContain("top=10"));
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");
  });

  test("errors are explained", async () => {
    reply({ error: "failed" }, 500);
    render(<StatsDetails />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudieron cargar/);
  });

  test("'Borrar mi historial' asks first, then deletes and reloads", async () => {
    reply(details);
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload });
    render(<StatsDetails />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar mi historial" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/No se puede deshacer/);
    expect(actions.deleteHistory).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));
    });
    expect(actions.deleteHistory).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });
});
