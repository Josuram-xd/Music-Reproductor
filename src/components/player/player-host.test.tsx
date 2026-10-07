import { render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PlayerHost } from "./player-host";

const store = vi.hoisted(() => ({
  runPlayerAction: vi.fn(),
  player: {
    play: vi.fn(),
    pause: vi.fn(),
    back: vi.fn(),
    next: vi.fn(),
    seekBy: vi.fn(),
    seek: vi.fn(),
  },
  usePlayerStore: { getState: vi.fn(() => ({ current: null })), subscribe: vi.fn(() => () => {}) },
}));
vi.mock("@/stores/player-store", () => store);

const press = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, "mediaSession");
});

describe("PlayerHost", () => {
  test("turns shortcuts into player actions and stops page scrolling", () => {
    render(<PlayerHost />);
    const space = press(" ");
    press("ArrowRight", { shiftKey: true });
    press("x");

    expect(space.defaultPrevented).toBe(true);
    expect(store.runPlayerAction.mock.calls).toEqual([["toggle"], ["next"]]);
  });

  test("holding Space does not flip play/pause, holding an arrow keeps seeking", () => {
    render(<PlayerHost />);
    const held = press(" ", { repeat: true });
    press("ArrowLeft", { repeat: true });
    press("ArrowLeft", { repeat: true });

    expect(held.defaultPrevented).toBe(true);
    expect(store.runPlayerAction.mock.calls).toEqual([["seekBackward"], ["seekBackward"]]);
  });

  test("stops listening when unmounted", () => {
    const { unmount } = render(<PlayerHost />);
    unmount();
    press(" ");
    expect(store.runPlayerAction).not.toHaveBeenCalled();
  });

  test("binds media keys when the Media Session API exists", () => {
    const setActionHandler = vi.fn();
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: { metadata: null, playbackState: "none", setActionHandler },
    });
    const { unmount } = render(<PlayerHost />);
    expect(setActionHandler).toHaveBeenCalledWith("play", expect.any(Function));
    expect(store.usePlayerStore.subscribe).toHaveBeenCalledOnce();
    unmount();
    expect(setActionHandler).toHaveBeenCalledWith("play", null);
  });
});
