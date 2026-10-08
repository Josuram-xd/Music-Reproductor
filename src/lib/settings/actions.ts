"use server";

import { authenticate } from "@/lib/auth/api";
import { parseSettingsPatch, type UserSettings } from "./settings";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

/**
 * Saves some preferences (the rest keep their value or default). No
 * `refresh()`: the client store already shows the change.
 */
export async function updateUserSettings(
  patch: Partial<UserSettings>,
): Promise<SettingsActionResult> {
  const clean = parseSettingsPatch(patch);
  if (!clean) return { ok: false, error: "invalid_request" };
  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };

  const { error } = await auth.supabase.from("user_settings").upsert(
    {
      owner_id: auth.userId,
      ...(clean.floatingPlayer !== undefined ? { floating_player: clean.floatingPlayer } : {}),
      ...(clean.floatingPos !== undefined ? { floating_pos: clean.floatingPos } : {}),
      ...(clean.radioEnabled !== undefined ? { radio_enabled: clean.radioEnabled } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
  return error ? { ok: false, error: "failed" } : { ok: true };
}
