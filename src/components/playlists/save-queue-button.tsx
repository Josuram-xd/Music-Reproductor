"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
import { UUID } from "@/lib/library/folders";
import { PLAYLIST_MESSAGES } from "@/lib/playlists/messages";
import { getPlayer } from "@/stores/player-store";
import { toast } from "@/stores/toast-store";
import { createPlaylistWith } from "./playlist-client";
import { PlaylistDialog } from "./playlist-dialog";

/** Library tracks of the queue, in order (YouTube/Spotify ones are not library rows). */
function queuedTrackIds(): string[] {
  return getPlayer()
    .getSnapshot()
    .queue.map((track) => track.id)
    .filter((id) => UUID.test(id));
}

/** Queue header button: saves the whole queue, in order, as a new playlist. */
export function SaveQueueButton() {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const start = () => {
    if (queuedTrackIds().length === 0) return toast(PLAYLIST_MESSAGES.emptyQueue);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        aria-label="Guardar la cola como playlist"
        title="Guardar la cola como playlist"
        className="flex size-11 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        <Save aria-hidden className="size-5" />
      </button>
      <PlaylistDialog
        state={
          open
            ? {
                mode: "create",
                title: "Guardar la cola",
                description: "Se creará una playlist con todas las canciones de la cola, en orden.",
                submitLabel: "Guardar",
              }
            : null
        }
        onClose={() => setOpen(false)}
        onCreate={(name) => {
          setOpen(false);
          startTransition(async () => {
            await createPlaylistWith(name, queuedTrackIds(), PLAYLIST_MESSAGES.savedQueue(name));
          });
        }}
      />
    </>
  );
}
