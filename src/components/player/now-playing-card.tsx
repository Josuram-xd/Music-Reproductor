"use client";

import { usePlayerStore } from "@/stores/player-store";

/** "Now playing" summary at the top of the queue panel. */
export function NowPlayingCard() {
  const current = usePlayerStore((s) => s.current);
  return (
    <div className="rounded-3xl bg-surface-2/60 p-4">
      <p className="text-xs font-semibold tracking-wide text-accent uppercase">Ahora suena</p>
      {current ? (
        <>
          <p className="mt-1 truncate font-semibold">{current.title}</p>
          <p className="truncate text-sm text-muted">{current.artist ?? "Artista desconocido"}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">Nada por ahora, nya~</p>
      )}
    </div>
  );
}
