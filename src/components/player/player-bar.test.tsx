import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PlayerSnapshot } from "@/lib/player/player-engine";
import { player, usePlayerStore } from "@/stores/player-store";
import { PlayerBar } from "./player-bar";

const idle = usePlayerStore.getState();

const loaded = (overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({
  ...idle,
  current: { id: "t1", source: "audio", title: "Neko Lofi", artist: "Mochi" },
  queue: [{ id: "t1", source: "audio", title: "Neko Lofi" }],
  state: "paused",
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
  usePlayerStore.setState(idle, true);
});

describe("PlayerBar", () => {
  test("empty state", () => {
    render(<PlayerBar />);
    expect(screen.getByText("Nada sonando, nya~")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproducir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  test("shows the current track and its times", () => {
    usePlayerStore.setState(loaded(), true);
    render(<PlayerBar />);
    expect(screen.getByText("Neko Lofi")).toBeInTheDocument();
    expect(screen.getByText("Mochi")).toBeInTheDocument();
    expect(screen.getByText("1:23")).toBeInTheDocument();
    expect(screen.getByText("3:45")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Progreso" })).toHaveAttribute(
      "aria-valuetext",
      "1:23 de 3:45",
    );
  });

  test("buttons call the player", () => {
    usePlayerStore.setState(loaded(), true);
    render(<PlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Retroceder 10 s" }));
    fireEvent.click(screen.getByRole("button", { name: "Adelantar 10 s" }));
    fireEvent.click(screen.getByRole("button", { name: "Repetir: no" }));
    fireEvent.click(screen.getByRole("button", { name: "Silenciar" }));

    expect(player.toggle).toHaveBeenCalledOnce();
    expect(player.back).toHaveBeenCalledOnce();
    expect(player.next).toHaveBeenCalledOnce();
    expect(player.seekBy).toHaveBeenNthCalledWith(1, -10);
    expect(player.seekBy).toHaveBeenNthCalledWith(2, 10);
    expect(player.cycleRepeat).toHaveBeenCalledOnce();
    expect(player.toggleMute).toHaveBeenCalledOnce();
  });

  test("sliders seek and change the volume", () => {
    usePlayerStore.setState(loaded(), true);
    render(<PlayerBar />);
    fireEvent.change(screen.getByRole("slider", { name: "Progreso" }), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Volumen" }), { target: { value: "0.3" } });
    expect(player.seek).toHaveBeenCalledWith(120);
    expect(player.setVolume).toHaveBeenCalledWith(0.3);
  });

  test("reflects playing, repeat and mute states", () => {
    usePlayerStore.setState(loaded({ state: "playing", repeat: "one", muted: true }), true);
    render(<PlayerBar />);
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repetir: esta canción" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Activar sonido" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Volumen" })).toHaveValue("0");
  });

  test("next is disabled at the end of the queue", () => {
    usePlayerStore.setState(loaded({ hasNext: false }), true);
    render(<PlayerBar />);
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
});
