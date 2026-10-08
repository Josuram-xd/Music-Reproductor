import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PlayerSnapshot } from "@/lib/player/player-engine";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { player, usePlayerStore } from "@/stores/player-store";
import { useSettingsStore } from "@/stores/settings-store";
import { FloatingPlayer } from "./floating-player";
import { PlayerChrome } from "./player-chrome";

vi.mock("@/lib/settings/actions", () => ({
  updateUserSettings: vi.fn(async () => ({ ok: true })),
}));

const idle = usePlayerStore.getState();
const loaded = (overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({
  ...idle,
  current: {
    id: "t1",
    source: "audio",
    title: "Neko Lofi",
    artist: "Mochi",
    coverUrl: "https://img.test/cover.jpg",
  },
  queue: [{ id: "t1", source: "audio", title: "Neko Lofi" }],
  state: "playing",
  time: 83,
  duration: 225,
  hasNext: true,
  ...overrides,
});

beforeEach(() => {
  for (const action of Object.keys(player) as (keyof typeof player)[]) {
    vi.spyOn(player, action).mockImplementation(() => undefined as never);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  usePlayerStore.setState(idle, true);
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: false });
});

describe("FloatingPlayer", () => {
  test("shows cover, title, artist and the time", () => {
    usePlayerStore.setState(loaded(), true);
    const { container } = render(<FloatingPlayer />);
    expect(screen.getByRole("region", { name: "Mini-reproductor" })).toBeInTheDocument();
    expect(screen.getByText("Neko Lofi")).toBeInTheDocument();
    expect(screen.getByText("Mochi")).toBeInTheDocument();
    expect(screen.getByText("1:23 / 3:45")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "https://img.test/cover.jpg");
  });

  test("⏮ ⏯ ⏭ and the progress bar drive the player", () => {
    usePlayerStore.setState(loaded(), true);
    render(<FloatingPlayer />);
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.change(screen.getByRole("slider", { name: "Progreso" }), {
      target: { value: "120" },
    });
    expect(player.back).toHaveBeenCalledOnce();
    expect(player.toggle).toHaveBeenCalledOnce();
    expect(player.next).toHaveBeenCalledOnce();
    expect(player.seek).toHaveBeenCalledWith(120);
  });

  test("empty player: nothing to play", () => {
    render(<FloatingPlayer />);
    expect(screen.getByText("Nada sonando, nya~")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproducir" })).toBeDisabled();
  });

  test("a touch keeps it fully opaque for 4 s", () => {
    vi.useFakeTimers();
    render(<FloatingPlayer />);
    const widget = screen.getByRole("region", { name: "Mini-reproductor" });
    expect(widget).not.toHaveAttribute("data-awake");
    fireEvent.pointerDown(widget, { pointerType: "touch" });
    expect(widget).toHaveAttribute("data-awake");
    act(() => vi.advanceTimersByTime(3999));
    expect(widget).toHaveAttribute("data-awake");
    act(() => vi.advanceTimersByTime(1));
    expect(widget).not.toHaveAttribute("data-awake");
  });

  test("a mouse click does not (CSS hover handles the mouse)", () => {
    render(<FloatingPlayer />);
    const widget = screen.getByRole("region", { name: "Mini-reproductor" });
    fireEvent.pointerDown(widget, { pointerType: "mouse" });
    expect(widget).not.toHaveAttribute("data-awake");
  });
});

describe("PlayerChrome", () => {
  test("nothing until the preference is known", () => {
    const { container } = render(<PlayerChrome />);
    expect(container).toBeEmptyDOMElement();
  });

  test("floating player by default, classic bar when it is off", () => {
    useSettingsStore.setState({ loaded: true, floatingPlayer: true });
    const { rerender } = render(<PlayerChrome />);
    expect(screen.getByRole("region", { name: "Mini-reproductor" })).toBeInTheDocument();
    act(() => useSettingsStore.setState({ floatingPlayer: false }));
    rerender(<PlayerChrome />);
    expect(screen.queryByRole("region", { name: "Mini-reproductor" })).toBeNull();
    expect(screen.getByRole("region", { name: "Reproductor" })).toBeInTheDocument();
  });
});
