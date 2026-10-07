"use client";

import {
  type Announcements,
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  type ScreenReaderInstructions,
  TouchSensor,
  type UniqueIdentifier,
  useDroppable,
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
import { GripVertical } from "lucide-react";
import { type ReactNode, useId, useMemo } from "react";
import { NowPlayingCard } from "@/components/player/now-playing-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTime } from "@/lib/player/format";
import type { Track } from "@/lib/player/types";
import { usePlayerStore } from "@/stores/player-store";
import { queue } from "@/stores/queue-store";
import { type DropEdge, useTrackDrop } from "./track-drop";

/** Droppable id of the "Ahora suena" card: position 0 of the queue. */
const NOW_PLAYING = "now-playing";

/** What plays after the current track (the whole queue when nothing is loaded). */
export function upNextOf(items: readonly Track[], currentId: string | undefined): Track[] {
  if (!currentId) return [...items];
  return items.slice(items.findIndex((track) => track.id === currentId) + 1);
}

// The pointer decides when there is one (so the "Ahora suena" card is easy to
// hit); the keyboard sensor has no pointer, so it falls back to the closest item.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
};

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Para reordenar, pulsa espacio o intro, mueve la canción con las flechas y vuelve a pulsar espacio o intro para soltarla. Escape cancela.",
};

/**
 * "Ahora suena" + the up-next list. Up next is sortable with dnd-kit (mouse,
 * long press on touch, keyboard); tracks from the library are dropped with
 * native drag & drop. Dropping on "Ahora suena" asks what to do.
 */
export function QueueBoard() {
  const dndId = useId();
  const current = usePlayerStore((s) => s.current);
  const items = usePlayerStore((s) => s.queue);
  const upNext = useMemo(() => upNextOf(items, current?.id), [items, current?.id]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Long press, so swiping the list still scrolls (docs/ARCHITECTURE.md).
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: UniqueIdentifier) =>
    upNext.find((track) => track.id === id)?.title ?? "la canción";
  const placeOf = (id: UniqueIdentifier) =>
    id === NOW_PLAYING
      ? "encima de la canción que suena"
      : `en la posición ${upNext.findIndex((track) => track.id === id) + 1} de ${upNext.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Has cogido ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(active.id)} está ${placeOf(over.id)}.`
        : `${titleOf(active.id)} está fuera de la cola.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Has soltado ${titleOf(active.id)} ${placeOf(over.id)}.`
        : `${titleOf(active.id)} vuelve a su sitio.`,
    onDragCancel: ({ active }) => `Cancelado. ${titleOf(active.id)} vuelve a su sitio.`,
  };

  /** Where a track goes when it ends up at `index` of up next. */
  const afterIdFor = (list: readonly Track[], index: number) =>
    index > 0 ? list[index - 1]!.id : (current?.id ?? null);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const from = upNext.findIndex((track) => track.id === active.id);
    const track = upNext[from];
    if (!track) return;
    if (over.id === NOW_PLAYING) return queue.dropOnCurrent(track);
    const to = upNext.findIndex((t) => t.id === over.id);
    if (to < 0 || to === from) return;
    queue.place(track, afterIdFor(arrayMove(upNext, from, to), to));
  };

  const dropFromLibrary = (track: Track, target: Track, edge: DropEdge) => {
    if (track.id === target.id) return;
    const rest = upNext.filter((t) => t.id !== track.id);
    const index = rest.findIndex((t) => t.id === target.id) + (edge === "after" ? 1 : 0);
    queue.place(track, afterIdFor(rest, index));
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      <NowPlayingDropZone>
        <NowPlayingCard />
      </NowPlayingDropZone>

      {upNext.length > 0 ? (
        <section aria-labelledby={`${dndId}-up-next`} className="flex flex-col gap-2">
          <h3
            id={`${dndId}-up-next`}
            className="px-1 text-xs font-semibold tracking-wide text-muted uppercase"
          >
            A continuación · {upNext.length}
          </h3>
          <SortableContext items={upNext.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1">
              {upNext.map((track) => (
                <QueueRow
                  key={track.id}
                  track={track}
                  onLibraryDrop={(dropped, edge) => dropFromLibrary(dropped, track, edge)}
                />
              ))}
            </ol>
          </SortableContext>
        </section>
      ) : (
        <EmptyQueueDropZone hasCurrent={current !== null} />
      )}
    </DndContext>
  );
}

/** "Ahora suena": dropping here (from the queue or the library) opens the 3-option dialog. */
function NowPlayingDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: NOW_PLAYING });
  const native = useTrackDrop((track) => queue.dropOnCurrent(track));
  const over = isOver || native.edge !== null;

  return (
    <div
      ref={setNodeRef}
      {...native.props}
      className={`rounded-3xl transition ${over ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""}`}
    >
      {children}
      {over ? (
        <p className="px-4 pb-3 text-xs font-semibold text-primary">
          Suelta para elegir qué hacer, nya~
        </p>
      ) : null}
    </div>
  );
}

function QueueRow({
  track,
  onLibraryDrop,
}: {
  track: Track;
  onLibraryDrop: (track: Track, edge: DropEdge) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });
  const native = useTrackDrop(onLibraryDrop);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...native.props}
      className={`relative flex items-center gap-1 rounded-2xl bg-surface transition-colors hover:bg-surface-2/60 ${
        isDragging ? "z-10 bg-surface-2 shadow-[0_0_24px_-6px_var(--primary)]" : ""
      }`}
    >
      {native.edge ? (
        <span
          aria-hidden
          className={`absolute inset-x-2 h-0.5 rounded-full bg-primary ${
            native.edge === "before" ? "-top-0.5" : "-bottom-0.5"
          }`}
        />
      ) : null}
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
        onClick={() => queue.playQueued(track.id)}
        title="Reproducir ahora"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-2 pr-3 text-left focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{track.title}</span>
          <span className="block truncate text-xs text-muted">
            {track.artist ?? "Artista desconocido"}
          </span>
        </span>
        {track.durationS ? (
          <span className="shrink-0 text-xs text-muted tabular-nums">
            {formatTime(track.durationS)}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** Nothing up next: the whole panel area accepts tracks from the library. */
function EmptyQueueDropZone({ hasCurrent }: { hasCurrent: boolean }) {
  const native = useTrackDrop((track) => queue.append(track));
  return (
    <div
      {...native.props}
      className={`rounded-3xl border-2 border-dashed transition ${
        native.edge ? "border-primary bg-primary/5" : "border-transparent"
      }`}
    >
      {hasCurrent ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          No hay nada a continuación. Arrastra canciones de tu biblioteca aquí 🐾
        </p>
      ) : (
        <EmptyState title="La cola está vacía">
          Arrastra canciones de tu biblioteca aquí y aparecerán en la cola 🐾
        </EmptyState>
      )}
    </div>
  );
}
