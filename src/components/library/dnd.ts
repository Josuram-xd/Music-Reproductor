"use client";

import { type DragEvent, useState } from "react";

/** Something from the library being dragged inside the app (not files from the PC). */
export interface DragItem {
  kind: "folder" | "track";
  id: string;
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
      event.dataTransfer.effectAllowed = "move";
    },
    onDragEnd() {
      dragging = null;
    },
  };
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
  const accepts = (event: DragEvent) =>
    event.dataTransfer.types.includes(MIME) && dragging !== null && canDrop(dragging);

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
