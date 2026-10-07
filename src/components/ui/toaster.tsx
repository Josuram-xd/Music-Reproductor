"use client";

import { X } from "lucide-react";
import { type ToastTone, useToastStore } from "@/stores/toast-store";

const TONES: Record<ToastTone, string> = {
  info: "border-secondary/40",
  success: "border-accent/50",
  warn: "border-warn/60",
  error: "border-danger/60",
};

/** Toast stack, above the player bar and the mobile tab bar. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4 @tablet:bottom-28"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl border bg-surface py-2 pr-1 pl-4 text-sm shadow-[0_8px_32px_-8px_rgb(0_0_0/0.6)] transition motion-reduce:transition-none starting:translate-y-2 starting:opacity-0 ${TONES[t.tone]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => dismiss(t.id)}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
