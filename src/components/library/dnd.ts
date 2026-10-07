"use client";

import { type DragEvent, useState } from "react";
import type { Track } from "@/lib/player/types";

/** Something from the library being dragged inside the app (not files from the PC). */
export interface DragItem {
  kind: "folder" | "track";
  id: string;
  /** The playable track, so it can be dropped on the queue. */
  track?: Track;
}

const MIME = "application/x-purrlist-item";

/**
 * The item being dragged. `dataTransfer.getData` is empty during dragover, so
 * drop targets read this to decide whether to accept it.
 */
let dragging: DragItem | null = null;

/** Props that make an element draggable as `item`. */
export function draggableProps(item: DragItem) {
  return {
    draggable: true,
    onDragStart(event: DragEvent) {
      dragging = item;
      event.dataTransfer.setData(MIME, JSON.stringify(item));
      // "copy" for the queue (the track stays in the library), "move" for folders.
      event.dataTransfer.effectAllowed = "copyMove";
    },
    onDragEnd() {
      dragging = null;
    },
  };
}

/** The library item being dragged in `event`, or null (files from the PC, other apps…). */
export function draggedItem(event: DragEvent): DragItem | null {
  return event.dataTransfer.types.includes(MIME) ? dragging : null;
}

/** Ends the drag after a custom drop target accepted it. */
export function finishDrag(): void {
  dragging = null;
}

/**
 * Drop target for library items. `canDrop` rejects invalid targets while
 * hovering (e.g. a folder over its own subfolder), so the cursor shows it.
 */
export function useDropTarget(
  onDrop: (item: DragItem) => void,
  canDrop: (item: DragItem) => boolean = () => true,
) {
  const [over, setOver] = useState(false);
  const accepts = (event: DragEvent) => {
    const item = draggedItem(event);
    return item !== null && canDrop(item);
  };

  return {
    over,
    props: {
      onDragOver(event: DragEvent) {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      },
      onDragLeave() {
        setOver(false);
      },
      onDrop(event: DragEvent) {
        setOver(false);
        if (!accepts(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const item = dragging!;
        dragging = null;
        onDrop(item);
      },
    },
  };
}
