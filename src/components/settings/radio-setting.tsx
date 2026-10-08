"use client";

import { settings, useSettingsStore } from "@/stores/settings-store";

/** Neko radio on/off: recommendations when the queue runs out. */
export function RadioSetting() {
  const loaded = useSettingsStore((s) => s.loaded);
  const enabled = useSettingsStore((s) => s.radioEnabled);

  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-3xl bg-surface p-4 has-disabled:cursor-wait has-disabled:opacity-60">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Radio neko</span>
        <span className="block text-sm text-muted">
          {enabled
            ? "Cuando quede una canción en la cola, añado 5 recomendaciones según lo que escuchas."
            : "Desactivada: la música se para al acabar la cola."}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={enabled}
        disabled={!loaded}
        onChange={(event) => void settings.update({ radioEnabled: event.target.checked })}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-secondary after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-text after:transition peer-checked:after:translate-x-5 motion-reduce:after:transition-none"
      />
    </label>
  );
}
