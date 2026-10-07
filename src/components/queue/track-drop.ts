"use client";

import { type DragEvent, useState } from "react";
import { draggedItem, finishDrag } from "@/components/library/dnd";
import type { Track } from "@/lib/player/types";

/** Half of the target the pointer is on: the dropped track goes before or after it. */
export type DropEdge = "before" | "after";

function draggedTrack(event: DragEvent): Track | null {
  const item = draggedItem(event);
  return item?.kind === "track" ? (item.track ?? null) : null;
}

function edgeOf(event: DragEvent): DropEdge {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

/**
 * Native drop target for tracks dragged from the library (HTML5 drag & drop,
 * like the folder tree). `edge` is where the track would land while hovering.
 * Nested targets win: they stop the event before it reaches their parent.
 */
export function useTrackDrop(onDrop: (track: Track, edge: DropEdge) => void) {
  const [edge, setEdge] = useState<DropEdge | null>(null);

  return {
    edge,
    props: {
      onDragOver(event: DragEvent) {
        if (!draggedTrack(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        setEdge(edgeOf(event));
      },
      onDragLeave(event: DragEvent) {
        // Moving onto a child also fires dragleave: only reset when really leaving.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setEdge(null);
      },
      onDrop(event: DragEvent) {
        setEdge(null);
        const track = draggedTrack(event);
        if (!track) return;
        event.preventDefault();
        event.stopPropagation();
        finishDrag();
        onDrop(track, edgeOf(event));
      },
    },
  };
}
