"use client";

import { ListPlus, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createPlaylist,
  deletePlaylist,
  type PlaylistActionResult,
  renamePlaylist,
} from "@/lib/playlists/actions";
import { PLAYLIST_MESSAGES, playlistErrorMessage } from "@/lib/playlists/messages";
import {
  applyPlaylistsChange,
  type PlaylistsChange,
  type PlaylistSummary,
} from "@/lib/playlists/playlists";
import { toast } from "@/stores/toast-store";
import { PlaylistCover } from "./playlist-cover";
import { PlaylistDialog, type PlaylistDialogState } from "./playlist-dialog";

const ICON_BUTTON =
  "flex size-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none";

/**
 * Grid of the user's playlists. Create, rename and delete show at once
 * (optimistic) and are saved with Server Actions.
 */
export function PlaylistsView({ playlists: initial }: { playlists: PlaylistSummary[] }) {
  const [playlists, applyChange] = useOptimistic(initial, applyPlaylistsChange);
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<PlaylistDialogState | null>(null);

  function run(
    change: PlaylistsChange,
    action: () => Promise<PlaylistActionResult>,
    success?: string,
  ) {
    setDialog(null);
    startTransition(async () => {
      applyChange(change);
      const result = await action();
      if (!result.ok) toast(playlistErrorMessage(result.error), { tone: "error" });
      else if (success) toast(success, { tone: "success", durationMs: 2500 });
    });
  }

  const create = (name: string) => {
    const id = crypto.randomUUID();
    run(
      { type: "create", playlist: { id, name, trackCount: 0, covers: [] } },
      () => createPlaylist(id, name),
      PLAYLIST_MESSAGES.created(name),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-surface-2 px-4 font-display font-semibold text-secondary transition hover:bg-secondary/15 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
        >
          <ListPlus aria-hidden className="size-4" />
          Nueva playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <EmptyState title="Aún no tienes playlists">
          Crea una y llénala desde tu biblioteca con «Añadir a…» o arrastrando canciones 🐾
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 @tablet:grid-cols-3 @desktop:grid-cols-4">
          {playlists.map((playlist) => (
            <li
              key={playlist.id}
              className="group relative flex flex-col gap-2 rounded-3xl bg-surface p-3 transition focus-within:ring-2 focus-within:ring-secondary hover:bg-surface-2/60"
            >
              <Link
                href={`/playlists/${playlist.id}`}
                className="flex flex-col gap-2 rounded-2xl outline-none"
              >
                <PlaylistCover covers={playlist.covers} />
                <span className="min-w-0 px-1">
                  <span className="block truncate font-semibold">{playlist.name}</span>
                  <span className="block text-sm text-muted">
                    {playlist.trackCount} {playlist.trackCount === 1 ? "canción" : "canciones"}
                  </span>
                </span>
              </Link>
              <div className="absolute top-4 right-4 flex gap-1 rounded-2xl bg-bg/70 opacity-100 backdrop-blur-sm transition @desktop:opacity-0 @desktop:group-focus-within:opacity-100 @desktop:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setDialog({ mode: "rename", playlist })}
                  aria-label={`Renombrar ${playlist.name}`}
                  title="Renombrar"
                  className={ICON_BUTTON}
                >
                  <Pencil aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ mode: "delete", playlist })}
                  aria-label={`Borrar ${playlist.name}`}
                  title="Borrar"
                  className={`${ICON_BUTTON} hover:text-danger`}
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PlaylistDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onCreate={create}
        onRename={(id, name) => run({ type: "rename", id, name }, () => renamePlaylist(id, name))}
        onDelete={(id) => run({ type: "delete", id }, () => deletePlaylist(id))}
      />
    </div>
  );
}
