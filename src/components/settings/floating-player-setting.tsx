"use client";

import { settings, useSettingsStore } from "@/stores/settings-store";

/** Floating mini-player on/off (off = the classic fixed bar at the bottom). */
export function FloatingPlayerSetting() {
  const loaded = useSettingsStore((s) => s.loaded);
  const enabled = useSettingsStore((s) => s.floatingPlayer);

  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-3xl bg-surface p-4 has-disabled:cursor-wait has-disabled:opacity-60">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Mini-reproductor flotante</span>
        <span className="block text-sm text-muted">
          {enabled
            ? "Una tarjetita que puedes mover a cualquier lado (y sacar de la ventana)."
            : "Desactivado: usas la barra fija de abajo."}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={enabled}
        disabled={!loaded}
        onChange={(event) => void settings.update({ floatingPlayer: event.target.checked })}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-secondary after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-text after:transition peer-checked:after:translate-x-5 motion-reduce:after:transition-none"
      />
    </label>
  );
}
