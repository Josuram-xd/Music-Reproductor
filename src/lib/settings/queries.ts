import "server-only";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, parseFloatingPosition, type UserSettings } from "./settings";

/** The user's preferences; the defaults if they never changed one (or on error). */
export async function getUserSettings(): Promise<UserSettings> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("floating_player, floating_pos, radio_enabled")
    .maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  return {
    floatingPlayer: data.floating_player,
    floatingPos: parseFloatingPosition(data.floating_pos),
    radioEnabled: data.radio_enabled,
  };
}
