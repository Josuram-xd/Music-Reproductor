import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EDGE_MARGIN } from "@/lib/player/floating-position";
import { FLOATING_MESSAGES } from "@/lib/player/messages";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/stores/toast-store";
import { FloatingPlayer } from "./floating-player";

const actions = vi.hoisted(() => ({
  updateUserSettings: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/settings/actions", () => actions);

const widget = () => screen.getByRole("region", { name: "Mini-reproductor" });
const handle = () => screen.getByRole("button", { name: /Mover el mini-reproductor/ });

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom: 1024 × 768 viewport, the widget measures 0 × 0.
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  Reflect.deleteProperty(window, "documentPictureInPicture");
});

describe("FloatingPlayer: position", () => {
  test("starts at the bottom right of the free area", () => {
    render(<FloatingPlayer />);
    expect(widget().style.left).toBe(`${1024 - EDGE_MARGIN}px`);
    expect(widget().style.top).toBe(`${768 - EDGE_MARGIN}px`);
  });

  test("uses the saved position", () => {
    useSettingsStore.setState({ floatingPos: { edge: "left", y: 0 } });
    render(<FloatingPlayer />);
    expect(widget().style.left).toBe(`${EDGE_MARGIN}px`);
    expect(widget().style.top).toBe(`${EDGE_MARGIN}px`);
  });

  test("dragging follows the pointer, then sticks to the nearest edge and saves it", async () => {
    render(<FloatingPlayer />);
    const start = { x: 1024 - EDGE_MARGIN, y: 768 - EDGE_MARGIN };
    fireEvent.pointerDown(handle(), {
      button: 0,
      clientX: start.x,
      clientY: start.y,
      pointerId: 1,
    });
    fireEvent.pointerMove(handle(), { clientX: 100, clientY: 300, pointerId: 1 });
    expect(widget().style.left).toBe("100px");
    expect(widget()).toHaveAttribute("data-dragging");
    await act(async () => {
      fireEvent.pointerUp(handle(), { pointerId: 1 });
    });
    expect(widget()).not.toHaveAttribute("data-dragging");
    const saved = useSettingsStore.getState().floatingPos!;
    expect(saved.edge).toBe("left");
    expect(saved.y).toBeCloseTo((300 - EDGE_MARGIN) / (768 - 2 * EDGE_MARGIN), 3);
    expect(widget().style.left).toBe(`${EDGE_MARGIN}px`);
    expect(actions.updateUserSettings).toHaveBeenCalledWith({ floatingPos: saved });
  });

  test("the keyboard moves it too", async () => {
    render(<FloatingPlayer />);
    await act(async () => {
      fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    });
    expect(useSettingsStore.getState().floatingPos).toEqual({ edge: "left", y: 1 });
  });

  test("never goes under the queue column, header or tabs", () => {
    const column = document.createElement("aside");
    column.setAttribute("data-floating-avoid", "right");
    column.getBoundingClientRect = () =>
      ({ left: 704, top: 0, bottom: 768, width: 320, height: 768 }) as DOMRect;
    document.body.append(column);
    render(<FloatingPlayer />);
    expect(widget().style.left).toBe(`${704 - EDGE_MARGIN}px`);
    column.remove();
  });
});

describe("FloatingPlayer: on/off and picture-in-picture", () => {
  test("✕ turns it off and says how to get it back", async () => {
    render(<FloatingPlayer />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ocultar el mini-reproductor" }));
    });
    expect(useSettingsStore.getState().floatingPlayer).toBe(false);
    expect(useToastStore.getState().toasts[0]?.message).toBe(FLOATING_MESSAGES.closed);
  });

  test("no Document PiP support, no button", () => {
    render(<FloatingPlayer />);
    expect(screen.queryByRole("button", { name: "Sacar de la ventana" })).toBeNull();
  });

  test("takes the player out of the window and brings it back", async () => {
    const pipDocument = document.implementation.createHTMLDocument("pip");
    const listeners: Record<string, () => void> = {};
    const pip = {
      document: pipDocument,
      close: vi.fn(() => listeners.pagehide?.()),
      addEventListener: (type: string, cb: () => void) => (listeners[type] = cb),
    } as unknown as Window;
    Object.defineProperty(window, "documentPictureInPicture", {
      configurable: true,
      value: { requestWindow: vi.fn(async () => pip), window: null },
    });

    render(<FloatingPlayer />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sacar de la ventana" }));
    });
    expect(pipDocument.body.textContent).toContain("Nada sonando, nya~");
    expect(screen.queryByRole("region", { name: "Mini-reproductor" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Traer el reproductor de vuelta" }));
    expect(pip.close).toHaveBeenCalled();
    expect(await screen.findByRole("region", { name: "Mini-reproductor" })).toBeInTheDocument();
  });
});
