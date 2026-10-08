import type { PlayerSnapshot } from "./player-engine";
import { type QueueStatePayload, type SavedQueue, toQueueStatePayload } from "./queue-state";

/** Wait after the last queue change before saving (drags come in bursts). */
export const SAVE_DEBOUNCE_MS = 1500;

interface QueueSyncDeps {
  getSnapshot: () => PlayerSnapshot;
  subscribe: (listener: (snapshot: PlayerSnapshot) => void) => () => void;
  /** Reads the saved queue; `null` if it could not. */
  load: () => Promise<SavedQueue | null>;
  /** Puts a saved queue in the player (it decides whether it still applies). */
  restore: (saved: SavedQueue) => Promise<unknown>;
  /** Sends a payload; `keepalive` when the page is going away. */
  save: (payload: QueueStatePayload, options: { keepalive: boolean }) => Promise<void>;
  debounceMs?: number;
}

/** Changes that deserve a save: order, loaded track and play/pause (to keep the position). */
const changeKey = (snapshot: PlayerSnapshot) =>
  `${snapshot.queue.map((track) => track.id).join(",")}|${snapshot.current?.id ?? ""}|${snapshot.state}`;

/**
 * Keeps `queue_state` in sync with the player: restores the saved queue on
 * start, then saves (debounced) whenever the queue, the loaded track or
 * play/pause changes, and right away with `flush` when the page is hidden.
 * Nothing is saved before the restore, so an empty player never wipes it.
 */
export function createQueueSync({
  getSnapshot,
  subscribe,
  load,
  restore,
  save,
  debounceMs = SAVE_DEBOUNCE_MS,
}: QueueSyncDeps) {
  let started = false;
  let stopped = false;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastKey = "";
  let lastSent = "";

  function flush({ keepalive = false } = {}): void {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!started || stopped) return;
    const payload = toQueueStatePayload(getSnapshot());
    const body = JSON.stringify(payload);
    if (body === lastSent) return;
    lastSent = body;
    save(payload, { keepalive }).catch(() => {
      // Try again on the next change.
      if (lastSent === body) lastSent = "";
    });
  }

  function onChange(snapshot: PlayerSnapshot): void {
    const key = changeKey(snapshot);
    if (key === lastKey) return;
    lastKey = key;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  return {
    async start(): Promise<void> {
      const saved = await load().catch(() => null);
      if (stopped) return;
      if (saved && saved.tracks.length > 0) await restore(saved).catch(() => undefined);
      if (stopped) return;
      started = true;
      const snapshot = getSnapshot();
      lastKey = changeKey(snapshot);
      // What was just restored is already saved; anything else is new.
      lastSent = saved ? JSON.stringify(toQueueStatePayload(snapshot)) : "";
      unsubscribe = subscribe(onChange);
    },
    flush,
    stop(): void {
      stopped = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
    },
  };
}
