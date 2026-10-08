"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  type ScreenReaderInstructions,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AudioLines, GripVertical, ListEnd, Pencil, Play, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { type LibraryTrack, toPlayerTrack } from "@/lib/library/tracks";
import { formatTime } from "@/lib/player/format";
import {
  deletePlaylist,
  moveInPlaylist,
  type PlaylistActionResult,
  removeFromPlaylist,
  renamePlaylist,
} from "@/lib/playlists/actions";
import { PLAYLIST_MESSAGES, playlistErrorMessage } from "@/lib/playlists/messages";
import {
  applyPlaylistChange,
  type PlaylistChange,
  type PlaylistDetail,
} from "@/lib/playlists/playlists";
import { usePlayerStore } from "@/stores/player-store";
import { queue } from "@/stores/queue-store";
import { toast } from "@/stores/toast-store";
import { PlaylistCover } from "./playlist-cover";
import { PlaylistDialog, type PlaylistDialogState } from "./playlist-dialog";

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Para reordenar, pulsa espacio o intro, mueve la canción con las flechas y vuelve a pulsar espacio o intro para soltarla. Escape cancela.",
};

/** Total length as "1 h 05 min" / "12 min". */
function totalLength(tracks: readonly LibraryTrack[]): string {
  const minutes = Math.round(
    tracks.reduce((sum, track) => sum + Number(track.duration_s ?? 0), 0) / 60,
  );
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/**
 * One playlist: play it, add it to the queue, reorder (dnd-kit: mouse, long
 * press, keyboard) and remove tracks. Changes are optimistic; reordering
 * only rewrites the moved track's rank on the server.
 */
export function PlaylistView({ playlist: initial }: { playlist: PlaylistDetail }) {
  const dndId = useId();
  const router = useRouter();
  const [playlist, applyChange] = useOptimistic(initial, applyPlaylistChange);
  const [, startTransition] = useTransition();
  const [dialog, setDialog] = useState<PlaylistDialogState | null>(null);
  const { tracks } = playlist;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function run(change: PlaylistChange, action: () => Promise<PlaylistActionResult>) {
    setDialog(null);
    startTransition(async () => {
      applyChange(change);
      const result = await action();
      if (!result.ok) toast(playlistErrorMessage(result.error), { tone: "error" });
    });
  }

  const play = (startId?: string) => {
    const first = startId ?? tracks[0]?.id;
    if (!first) return toast(PLAYLIST_MESSAGES.empty);
    queue.playList(tracks.map(toPlayerTrack), first);
  };

  const addToQueue = () => {
    if (tracks.length === 0) return toast(PLAYLIST_MESSAGES.empty);
    const added = queue.addMany(tracks.map(toPlayerTrack));
    toast(PLAYLIST_MESSAGES.queued(added), { tone: added ? "success" : "info", durationMs: 2500 });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = tracks.findIndex((t) => t.id === active.id);
    const to = tracks.findIndex((t) => t.id === over.id);
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(tracks, from, to);
    const trackId = String(active.id);
    const afterId = to > 0 ? reordered[to - 1]!.id : null;
    run({ type: "move", trackId, afterId }, () => moveInPlaylist(playlist.id, trackId, afterId));
  };

  const covers = tracks.flatMap((t) => (t.cover_url ? [t.cover_url] : [])).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 @tablet:flex-row @tablet:items-end">
        <PlaylistCover covers={covers} className="w-40 shrink-0 @tablet:w-48" />
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">Playlist</p>
            <h1 className="truncate font-display text-3xl font-semibold">{playlist.name}</h1>
            <p className="text-sm text-muted">
              {tracks.length} {tracks.length === 1 ? "canción" : "canciones"}
              {tracks.length > 0 ? ` · ${totalLength(tracks)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => play()} disabled={tracks.length === 0}>
              <Play aria-hidden className="size-4" />
              Reproducir
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={addToQueue}
              disabled={tracks.length === 0}
            >
              <ListEnd aria-hidden className="size-4" />
              Añadir a la cola
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialog({ mode: "rename", playlist })}
            >
              <Pencil aria-hidden className="size-4" />
              Renombrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialog({ mode: "delete", playlist })}
              className="hover:text-danger"
            >
              <Trash2 aria-hidden className="size-4" />
              Borrar
            </Button>
          </div>
        </div>
      </header>

      {tracks.length === 0 ? (
        <EmptyState title="Esta playlist está vacía">
          Ve a tu biblioteca y usa «Añadir a…» en una canción, o arrástrala a esta playlist en la
          barra lateral 🐾
        </EmptyState>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{ screenReaderInstructions }}
        >
          <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1">
              {tracks.map((track, index) => (
                <PlaylistRow
                  key={track.id}
                  track={track}
                  position={index + 1}
                  onPlay={() => play(track.id)}
                  onRemove={() =>
                    run({ type: "remove", trackId: track.id }, () =>
                      removeFromPlaylist(playlist.id, track.id),
                    )
                  }
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <PlaylistDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onRename={(id, name) => run({ type: "rename", name }, () => renamePlaylist(id, name))}
        onDelete={(id) => {
          setDialog(null);
          startTransition(async () => {
            const result = await deletePlaylist(id);
            if (!result.ok) toast(playlistErrorMessage(result.error), { tone: "error" });
            else router.push("/playlists");
          });
        }}
      />
    </div>
  );
}

function PlaylistRow({
  track,
  position,
  onPlay,
  onRemove,
}: {
  track: LibraryTrack;
  position: number;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const isCurrent = usePlayerStore((s) => s.current?.id === track.id);
  const playing = usePlayerStore((s) => s.state === "playing");
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative flex items-center gap-1 rounded-2xl transition-colors hover:bg-surface ${
        isDragging ? "z-10 bg-surface-2 shadow-[0_0_24px_-6px_var(--primary)]" : ""
      } ${isCurrent ? "bg-primary/10" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${track.title}`}
        title="Arrastra para reordenar"
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        onClick={onPlay}
        aria-current={isCurrent ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-2 pr-2 text-left focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">
          {isCurrent && playing ? (
            <AudioLines
              aria-hidden
              className="ml-auto size-4 text-primary motion-safe:animate-pulse"
            />
          ) : (
            position
          )}
        </span>
        <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {track.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.cover_url}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute inset-0 size-full object-cover"
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${isCurrent ? "text-primary" : ""}`}>
            {track.title}
          </span>
          <span className="block truncate text-sm text-muted">
            {track.artist ?? "Artista desconocido"}
          </span>
        </span>
        <span className="shrink-0 text-sm text-muted tabular-nums">
          {track.duration_s !== null ? formatTime(Number(track.duration_s)) : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${track.title} de la playlist`}
        title="Quitar de la playlist (sigue en tu biblioteca)"
        className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-xl text-muted opacity-60 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-danger focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}
