"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { chooseDockPlacement } from "@/lib/player/youtube-dock";
import { findYouTubeHost } from "@/lib/player/youtube-host";
import { player, usePlayerStore } from "@/stores/player-store";

/** Marks where the video goes in "Ahora suena". */
export const YOUTUBE_SLOT_ATTR = "data-youtube-slot";
/** Marks a scroll container that clips the slot (the queue column). */
export const YOUTUBE_CLIP_ATTR = "data-youtube-clip";

// Top corner: the bottom one belongs to the floating mini-player and the toasts.
const FLOATING =
  "position:fixed;right:16px;top:calc(4.5rem + env(safe-area-inset-top));width:min(240px,calc(100vw - 32px));aspect-ratio:16/9;";
const SHARED =
  "z-index:30;overflow:hidden;background:#000;box-shadow:4px 4px 0 0 var(--pixel-shadow);";

/**
 * Keeps the YouTube player visible (YouTube ToS) while a YouTube track is
 * loaded: over the "Ahora suena" slot when one is on screen, otherwise
 * floating in the top corner. The iframe itself never moves in the DOM.
 * Slots inside an open modal (the mobile queue sheet) are skipped: the top
 * layer would cover the video.
 */
export function YouTubeDock() {
  const isYouTube = usePlayerStore((s) => s.current?.source === "youtube");
  const [hostElement, setHostElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isYouTube) {
      const host = findYouTubeHost();
      if (host) host.hidden = true;
      return;
    }
    let frame = 0;
    let last = "";
    const place = () => {
      frame = requestAnimationFrame(place);
      const host = findYouTubeHost();
      if (!host) return;
      setHostElement(host);
      const slots = [...document.querySelectorAll<HTMLElement>(`[${YOUTUBE_SLOT_ATTR}]`)]
        .filter((slot) => !slot.closest("dialog"))
        .map((slot) => ({
          rect: slot.getBoundingClientRect(),
          clip: slot.closest(`[${YOUTUBE_CLIP_ATTR}]`)?.getBoundingClientRect() ?? null,
        }));
      const placement = chooseDockPlacement(slots, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      const style =
        placement.mode === "docked"
          ? `position:fixed;left:${placement.left}px;top:${placement.top}px;width:${placement.width}px;height:${placement.height}px;`
          : FLOATING;
      if (style === last && !host.hidden) return;
      last = style;
      host.style.cssText = style + SHARED;
      host.hidden = false;
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [isYouTube]);

  if (!isYouTube || !hostElement) return null;
  return createPortal(
    <button
      type="button"
      onClick={player.activateAudio}
      aria-label="Activar sonido de YouTube"
      title="Activar sonido"
      className="absolute bottom-2 left-2 z-10 flex min-h-11 items-center gap-2 border-2 border-surface-2 bg-surface px-3 text-sm font-semibold text-text shadow-pixel-sm hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
    >
      <Volume2 aria-hidden className="size-4" />
      Activar sonido
    </button>,
    hostElement,
  );
}
