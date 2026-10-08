"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { type ToastTone, useToastStore } from "@/stores/toast-store";
import { PixelHeart, PixelPaw, PixelSprite } from "./pixel/pixel";
import { BANG, CROSS } from "./pixel/sprites";

const TONES: Record<ToastTone, { border: string; icon: ReactNode }> = {
  info: { border: "border-secondary", icon: <PixelPaw className="w-4" color="var(--secondary)" /> },
  success: { border: "border-accent", icon: <PixelHeart className="w-4" color="var(--accent)" /> },
  warn: { border: "border-warn", icon: <PixelSprite sprite={BANG} className="w-3" /> },
  error: { border: "border-danger", icon: <PixelSprite sprite={CROSS} className="w-3" /> },
};

/** Toast stack, above the player bar and the mobile tab bar. Pixel boxes with a tone icon. */
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
          className={`pointer-events-auto flex max-w-sm items-center gap-3 border-2 bg-surface py-2 pr-1 pl-3 text-sm shadow-pixel transition motion-reduce:transition-none starting:translate-y-2 starting:opacity-0 ${TONES[t.tone].border}`}
        >
          <span aria-hidden className="flex w-4 shrink-0 justify-center">
            {TONES[t.tone].icon}
          </span>
          <span className="flex-1">{t.message}</span>
          {t.action ? (
            <button
              type="button"
              onClick={() => {
                dismiss(t.id);
                t.action!.run();
              }}
              className="h-9 shrink-0 px-3 font-display font-semibold text-secondary hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
            >
              {t.action.label}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => dismiss(t.id)}
            className="flex size-9 shrink-0 items-center justify-center text-muted hover:bg-surface-2 hover:text-text"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
