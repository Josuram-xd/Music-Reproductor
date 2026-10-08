import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { YouTubeDock } from "./youtube-dock";

const mocks = vi.hoisted(() => ({
  host: null as HTMLElement | null,
  activateAudio: vi.fn(),
}));

vi.mock("@/stores/player-store", () => ({
  player: { activateAudio: mocks.activateAudio },
  usePlayerStore: (selector: (state: { current: { source: string } }) => unknown) =>
    selector({ current: { source: "youtube" } }),
}));

vi.mock("@/lib/player/youtube-host", () => ({
  findYouTubeHost: () => mocks.host,
}));

describe("YouTubeDock", () => {
  beforeEach(() => {
    mocks.activateAudio.mockReset();
    mocks.host = document.createElement("div");
    document.body.append(mocks.host);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (frame: number) => window.clearTimeout(frame));
  });

  afterEach(() => {
    cleanup();
    mocks.host?.remove();
    mocks.host = null;
    vi.unstubAllGlobals();
  });

  test("shows a user-activated sound control over the YouTube player", async () => {
    render(<YouTubeDock />);

    const button = await screen.findByRole("button", { name: "Activar sonido de YouTube" });
    fireEvent.click(button);

    expect(mocks.activateAudio).toHaveBeenCalledOnce();
    expect(mocks.host).toContainElement(button);
  });
});
