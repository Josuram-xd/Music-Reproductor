"use client";

import { Radio } from "lucide-react";
import { radio } from "@/stores/radio";
import { useSettingsStore } from "@/stores/settings-store";

/** Queue header button: neko radio on/off (same setting as in Ajustes). */
export function RadioToggle() {
  const loaded = useSettingsStore((s) => s.loaded);
  const enabled = useSettingsStore((s) => s.radioEnabled);
  return (
    <button
      type="button"
      onClick={() => void radio.toggle()}
      disabled={!loaded}
      aria-pressed={enabled}
      aria-label="Radio neko"
      title={
        enabled
          ? "Radio neko activada: añade recomendaciones al acabarse la cola"
          : "Radio neko desactivada"
      }
      className="flex size-11 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:opacity-40 aria-pressed:text-accent"
    >
      <Radio aria-hidden className="size-5" />
    </button>
  );
}
