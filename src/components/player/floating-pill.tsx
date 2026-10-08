"use client";

import { LoaderCircle, Music, Pause, Play } from "lucide-react";
import { useSyncExternalStore } from "react";
import { player, usePlayerStore } from "@/stores/player-store";

/** Phone-sized windows (the `< 640 px` layout of docs/DESIGN.md). */
export const NARROW_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(NARROW_QUERY);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/** Whether the window is phone-sized (false on the server). */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(NARROW_QUERY).matches ?? false,
    () => false,
  );
}

/**
 * The mini-player folded into a pill on phones: cover + ⏯. Tapping the
 * cover/title opens the full card.
 */
export function MiniPlayerPill({ onExpand }: { onExpand: () => void }) {
  const current = usePlayerStore((s) => s.current);
  const state = usePlayerStore((s) => s.state);
  const time = usePlayerStore((s) => s.time);
  const duration = usePlayerStore((s) => s.duration);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const playing = state === "playing";
  const progress = duration > 0 ? Math.min(1, time / duration) : 0;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onExpand}
        aria-label={`Abrir el mini-reproductor${current ? `: ${current.title}` : ""}`}
        className="flex min-w-0 items-center gap-2 rounded-full pr-1 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        <span
          className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-secondary"
          // Progress drawn as a ring around the cover.
          style={{
            boxShadow: `0 0 0 2px var(--surface-2)`,
            background: `conic-gradient(var(--primary) ${progress * 360}deg, var(--surface-2) 0)`,
          }}
        >
          <span className="absolute inset-[3px] flex items-center justify-center overflow-hidden rounded-full bg-surface-2">
            {current?.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.coverUrl}
                alt=""
                draggable={false}
                className="size-full object-cover"
              />
            ) : (
              <Music aria-hidden className="size-4" />
            )}
          </span>
        </span>
        <span className="max-w-28 truncate text-sm font-semibold">
          {current?.title ?? "Nada sonando"}
        </span>
      </button>
      <button
        type="button"
        aria-label={playing ? "Pausar" : "Reproducir"}
        onClick={player.toggle}
        disabled={!current && queueLength === 0}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-bg transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:opacity-40"
      >
        {state === "loading" ? (
          <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
        ) : playing ? (
          <Pause aria-hidden className="size-5" />
        ) : (
          <Play aria-hidden className="ml-0.5 size-5" />
        )}
      </button>
    </div>
  );
}
