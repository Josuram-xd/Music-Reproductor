"use client";

import { useSettingsStore } from "@/stores/settings-store";
import { FloatingPlayer } from "./floating-player";
import { PlayerBar } from "./player-bar";

/**
 * The player controls: the floating mini-player (default) or the classic
 * fixed bar. Nothing until the user's preference is known, so neither
 * flashes in and out.
 */
export function PlayerChrome() {
  const loaded = useSettingsStore((s) => s.loaded);
  const floating = useSettingsStore((s) => s.floatingPlayer);
  if (!loaded) return null;
  return floating ? <FloatingPlayer /> : <PlayerBar />;
}
