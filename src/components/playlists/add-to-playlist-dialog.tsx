"use client";

import { ListMusic, ListPlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { PlaylistName } from "@/lib/playlists/playlists";
import { addTracksToPlaylist, createPlaylistWith } from "./playlist-client";
import { PlaylistDialog } from "./playlist-dialog";

interface AddToPlaylistDialogProps {
  /** The track being added, or `null` when closed. */
  track: { id: string; title: string } | null;
  playlists: PlaylistName[];
  onClose: () => void;
}

/** "Añadir a…": pick one of the playlists, or create a new one with the track. */
export function AddToPlaylistDialog({ track, playlists, onClose }: AddToPlaylistDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (track && !creating && !dialog.open) dialog.showModal();
    if ((!track || creating) && dialog.open) dialog.close();
  }, [track, creating]);

  const close = () => {
    setCreating(false);
    onClose();
  };

  const add = (playlist: PlaylistName) => {
    if (!track) return;
    startTransition(async () => {
      if (await addTracksToPlaylist(playlist, [track.id])) close();
    });
  };

  return (
    <>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => {
          if (!creating) close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border-2 border-surface-2 bg-surface p-0 text-text shadow-pixel backdrop:bg-bg/60 backdrop:backdrop-blur-sm"
      >
        {track ? (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-xl font-semibold">
                  Añadir a una playlist
                </h2>
                <p className="truncate text-sm text-muted">{track.title}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-busy={pending}>
              <li>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-semibold text-secondary transition hover:bg-secondary/15 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
                >
                  <ListPlus aria-hidden className="size-5 shrink-0" />
                  Nueva playlist…
                </button>
              </li>
              {playlists.map((playlist) => (
                <li key={playlist.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add(playlist)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:opacity-60"
                  >
                    <ListMusic aria-hidden className="size-5 shrink-0 text-muted" />
                    <span className="truncate">{playlist.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            {playlists.length === 0 ? (
              <p className="text-center text-sm text-muted">
                Aún no tienes playlists: crea la primera, nya~
              </p>
            ) : null}
          </div>
        ) : null}
      </dialog>

      <PlaylistDialog
        state={
          track && creating
            ? { mode: "create", description: `Empezará con «${track.title}».` }
            : null
        }
        onClose={close}
        onCreate={(name) => {
          if (!track) return;
          startTransition(async () => {
            if (await createPlaylistWith(name, [track.id])) close();
          });
        }}
      />
    </>
  );
}
