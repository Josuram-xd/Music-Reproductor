import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings/settings";
import { settings, useSettingsStore } from "./settings-store";
import { useToastStore } from "./toast-store";

const actions = vi.hoisted(() => ({
  updateUserSettings: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/settings/actions", () => actions);

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: false });
  useToastStore.setState({ toasts: [] });
});

describe("settings store", () => {
  test("starts with the defaults, not loaded", () => {
    expect(useSettingsStore.getState()).toMatchObject({ floatingPlayer: true, loaded: false });
  });

  test("hydrate loads the server values", () => {
    settings.hydrate({ ...DEFAULT_SETTINGS, floatingPlayer: false });
    expect(useSettingsStore.getState()).toMatchObject({ floatingPlayer: false, loaded: true });
  });

  test("update shows the change at once and saves it", async () => {
    const saving = settings.update({ floatingPlayer: false });
    expect(useSettingsStore.getState().floatingPlayer).toBe(false);
    expect(await saving).toBe(true);
    expect(actions.updateUserSettings).toHaveBeenCalledWith({ floatingPlayer: false });
  });

  test("a failed save goes back and tells the user", async () => {
    actions.updateUserSettings.mockResolvedValueOnce({ ok: false, error: "failed" } as never);
    settings.hydrate({ ...DEFAULT_SETTINGS, radioEnabled: false });
    expect(await settings.update({ floatingPlayer: false })).toBe(false);
    expect(useSettingsStore.getState()).toMatchObject({
      floatingPlayer: true,
      radioEnabled: false,
    });
    expect(useToastStore.getState().toasts[0]?.tone).toBe("error");
  });
});
