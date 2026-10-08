import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/stores/toast-store";
import { FloatingPlayerSetting } from "./floating-player-setting";

const pip = vi.hoisted(() => ({
  supported: true,
  open: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/lib/player/document-pip", () => ({
  openDocumentPip: pip.open,
  supportsDocumentPip: () => pip.supported,
}));
vi.mock("@/lib/settings/actions", () => ({
  updateUserSettings: vi.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  pip.supported = true;
  pip.close.mockReset();
  pip.open.mockReset().mockResolvedValue({ close: pip.close } as unknown as Window);
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true, floatingPlayer: false });
  useToastStore.setState({ toasts: [] });
});

describe("FloatingPlayerSetting", () => {
  test("opens Picture-in-Picture when enabling the floating player", async () => {
    render(<FloatingPlayerSetting />);

    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /Mini-reproductor flotante/ }));
    });

    expect(pip.open).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().floatingPlayer).toBe(true);
  });

  test("warns and still enables the in-page player when PiP is unsupported", async () => {
    pip.supported = false;
    render(<FloatingPlayerSetting />);

    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /Mini-reproductor flotante/ }));
    });

    expect(pip.open).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().floatingPlayer).toBe(true);
    expect(useToastStore.getState().toasts[0]?.message).toContain("no permite mostrar");
  });
});
