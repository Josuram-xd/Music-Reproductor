import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { player, usePlayerStore } from "@/stores/player-store";
import { useSettingsStore } from "@/stores/settings-store";
import { NARROW_QUERY } from "./floating-pill";
import { FloatingPlayer } from "./floating-player";

vi.mock("@/lib/settings/actions", () => ({
  updateUserSettings: vi.fn(async () => ({ ok: true })),
}));

const idle = usePlayerStore.getState();

function mockViewport(narrow: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === NARROW_QUERY && narrow,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

beforeEach(() => {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  usePlayerStore.setState(
    {
      ...idle,
      current: { id: "t1", source: "audio", title: "Neko Lofi", artist: "Mochi" },
      queue: [{ id: "t1", source: "audio", title: "Neko Lofi" }],
      state: "paused",
      time: 30,
      duration: 120,
    },
    true,
  );
  vi.spyOn(player, "toggle").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
  usePlayerStore.setState(idle, true);
});

describe("FloatingPlayer on phones", () => {
  test("folds into a pill: cover + ⏯ only", () => {
    mockViewport(true);
    render(<FloatingPlayer />);
    const widget = screen.getByRole("region", { name: "Mini-reproductor" });
    expect(widget).toHaveAttribute("data-compact");
    expect(
      screen.getByRole("button", { name: "Abrir el mini-reproductor: Neko Lofi" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
    expect(player.toggle).toHaveBeenCalledOnce();
  });

  test("tapping it opens the full card; tapping elsewhere folds it back", () => {
    mockViewport(true);
    render(<FloatingPlayer />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir el mini-reproductor/ }));
    const widget = screen.getByRole("region", { name: "Mini-reproductor" });
    expect(widget).not.toHaveAttribute("data-compact");
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(widget).toHaveAttribute("data-compact");
  });

  test("the open card can be folded with its button", () => {
    mockViewport(true);
    render(<FloatingPlayer />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir el mini-reproductor/ }));
    fireEvent.click(screen.getByRole("button", { name: "Plegar el mini-reproductor" }));
    expect(screen.getByRole("region", { name: "Mini-reproductor" })).toHaveAttribute(
      "data-compact",
    );
  });

  test("wider windows always show the full card", () => {
    mockViewport(false);
    render(<FloatingPlayer />);
    expect(screen.getByRole("region", { name: "Mini-reproductor" })).not.toHaveAttribute(
      "data-compact",
    );
    expect(screen.queryByRole("button", { name: "Plegar el mini-reproductor" })).toBeNull();
  });
});
