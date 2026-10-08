"use client";

import { Redo2, Undo2 } from "lucide-react";
import { queue, useQueueStore } from "@/stores/queue-store";

const BUTTON =
  "flex size-11 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

/** Undo / redo of queue edits, next to the queue title (also Ctrl+Z / Ctrl+Shift+Z). */
export function QueueHistoryButtons() {
  const canUndo = useQueueStore((s) => s.canUndo);
  const canRedo = useQueueStore((s) => s.canRedo);
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={queue.undo}
        disabled={!canUndo}
        aria-label="Deshacer cambio de la cola"
        title="Deshacer (Ctrl + Z)"
        className={BUTTON}
      >
        <Undo2 aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        onClick={queue.redo}
        disabled={!canRedo}
        aria-label="Rehacer cambio de la cola"
        title="Rehacer (Ctrl + Shift + Z)"
        className={BUTTON}
      >
        <Redo2 aria-hidden className="size-5" />
      </button>
    </div>
  );
}
