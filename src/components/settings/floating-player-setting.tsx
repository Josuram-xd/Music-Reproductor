"use client";

import { openDocumentPip, supportsDocumentPip } from "@/lib/player/document-pip";
import { FLOATING_MESSAGES } from "@/lib/player/messages";
import { settings, useSettingsStore } from "@/stores/settings-store";
import { toast } from "@/stores/toast-store";

/** Floating mini-player on/off (off = the classic fixed bar at the bottom). */
export function FloatingPlayerSetting() {
  const loaded = useSettingsStore((s) => s.loaded);
  const enabled = useSettingsStore((s) => s.floatingPlayer);

  const toggle = async (nextEnabled: boolean) => {
    let pip: Window | null = null;
    if (nextEnabled) {
      if (supportsDocumentPip()) {
        try {
          // Open before awaiting the settings save to preserve the click gesture.
          pip = await openDocumentPip();
        } catch {
          toast(FLOATING_MESSAGES.pipFailed, { tone: "warn" });
        }
      } else {
        toast(FLOATING_MESSAGES.pipUnsupported, { tone: "warn" });
      }
    }
    if (!(await settings.update({ floatingPlayer: nextEnabled }))) pip?.close();
  };

  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-3xl bg-surface p-4 has-disabled:cursor-wait has-disabled:opacity-60">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Mini-reproductor flotante</span>
        <span className="block text-sm text-muted">
          {enabled
            ? "En Chrome o Edge de escritorio, aparece encima de otras aplicaciones."
            : "Desactivado: usas la barra fija de abajo."}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={enabled}
        disabled={!loaded}
        onChange={(event) => void toggle(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-secondary after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-text after:transition peer-checked:after:translate-x-5 motion-reduce:after:transition-none"
      />
    </label>
  );
}
