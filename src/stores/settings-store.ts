import { create } from "zustand";
import { updateUserSettings } from "@/lib/settings/actions";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings/settings";
import { toast } from "./toast-store";

interface SettingsState extends UserSettings {
  /** The server values arrived (until then the shell shows no player chrome). */
  loaded: boolean;
}

export const useSettingsStore = create<SettingsState>()(() => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
}));

/** Preference changes: shown at once, saved in the background, undone on error. */
export const settings = {
  /** Seeds the store with the server values (once per page load). */
  hydrate(values: UserSettings) {
    useSettingsStore.setState({ ...values, loaded: true });
  },

  async update(patch: Partial<UserSettings>): Promise<boolean> {
    const previous = useSettingsStore.getState();
    useSettingsStore.setState(patch);
    const result = await updateUserSettings(patch).catch(() => ({ ok: false as const }));
    if (result.ok) return true;
    // Put back only what this call changed.
    const rollback = Object.fromEntries(
      Object.keys(patch).map((key) => [key, previous[key as keyof UserSettings]]),
    ) as Partial<UserSettings>;
    useSettingsStore.setState(rollback);
    toast("No se pudo guardar el ajuste. Inténtalo otra vez", { tone: "error" });
    return false;
  },
};
