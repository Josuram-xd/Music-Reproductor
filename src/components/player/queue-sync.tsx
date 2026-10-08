"use client";

import { useEffect } from "react";
import { QUEUE_STATE_URL, type SavedQueue } from "@/lib/player/queue-state";
import { createQueueSync } from "@/lib/player/queue-sync";
import { getPlayer } from "@/stores/player-store";
import { queue } from "@/stores/queue-store";

/** Browsers drop `keepalive` requests with bodies over 64 KB. */
const KEEPALIVE_MAX_BYTES = 60_000;

async function loadSavedQueue(): Promise<SavedQueue | null> {
  const response = await fetch(QUEUE_STATE_URL, { cache: "no-store" });
  return response.ok ? ((await response.json()) as SavedQueue) : null;
}

/**
 * Restores the saved queue (`queue_state`) when the app opens and keeps it
 * saved while the user plays and edits it. Renders nothing.
 */
export function QueueSync() {
  useEffect(() => {
    const engine = getPlayer();
    const sync = createQueueSync({
      getSnapshot: () => engine.getSnapshot(),
      subscribe: (listener) => engine.subscribe(listener),
      load: loadSavedQueue,
      restore: ({ tracks, currentId, positionS }) => queue.restore(tracks, currentId, positionS),
      async save(payload, { keepalive }) {
        const body = JSON.stringify(payload);
        const response = await fetch(QUEUE_STATE_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: keepalive && body.length < KEEPALIVE_MAX_BYTES,
        });
        if (!response.ok) throw new Error(`Saving the queue failed: ${response.status}`);
      },
    });
    void sync.start();

    // Closing or hiding the tab: save the latest position right away.
    const onHide = () => sync.flush({ keepalive: true });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      sync.stop();
    };
  }, []);

  return null;
}
