import { UUID } from "@/lib/library/folders";
import type { QueueStateRow } from "@/lib/supabase/database.types";
import type { PlayerSnapshot } from "./player-engine";
import type { Track } from "./types";

/** Same limit as the `queue_state.track_ids` check constraint. */
export const MAX_QUEUE_STATE_TRACKS = 2000;

export const QUEUE_STATE_URL = "/api/queue/state";

/** What the client sends to save its queue. */
export interface QueueStatePayload {
  trackIds: string[];
  currentId: string | null;
  positionS: number;
}

/** What the server returns to restore it: the tracks that still exist, in order. */
export interface SavedQueue {
  tracks: Track[];
  currentId: string | null;
  positionS: number;
}

export const EMPTY_SAVED_QUEUE: SavedQueue = { tracks: [], currentId: null, positionS: 0 };

/**
 * The part of the player snapshot worth saving. Only library tracks (uuid
 * ids) are kept; the position is rounded so tiny changes are not "new".
 */
export function toQueueStatePayload(
  snapshot: Pick<PlayerSnapshot, "queue" | "current" | "time">,
): QueueStatePayload {
  const trackIds = snapshot.queue
    .map((track) => track.id)
    .filter((id) => UUID.test(id))
    .slice(0, MAX_QUEUE_STATE_TRACKS);
  const currentId = snapshot.current?.id ?? null;
  return {
    trackIds,
    currentId: currentId && trackIds.includes(currentId) ? currentId : null,
    positionS: currentId ? Math.max(0, Math.round(snapshot.time * 10) / 10) : 0,
  };
}

/** Validates a request body, or `null` if it is not a valid payload. */
export function parseQueueStatePayload(body: unknown): QueueStatePayload | null {
  if (!body || typeof body !== "object") return null;
  const { trackIds, currentId, positionS } = body as Record<string, unknown>;
  if (!Array.isArray(trackIds) || trackIds.length > MAX_QUEUE_STATE_TRACKS) return null;
  if (!trackIds.every((id): id is string => typeof id === "string" && UUID.test(id))) return null;
  if (new Set(trackIds).size !== trackIds.length) return null;
  if (currentId !== null && (typeof currentId !== "string" || !trackIds.includes(currentId))) {
    return null;
  }
  if (typeof positionS !== "number" || !Number.isFinite(positionS) || positionS < 0) return null;
  return { trackIds, currentId, positionS };
}

/** Payload → `queue_state` columns (the current track is stored as an index). */
export function toQueueStateRow(
  payload: QueueStatePayload,
): Pick<QueueStateRow, "track_ids" | "current_index" | "position_s"> {
  const index = payload.currentId ? payload.trackIds.indexOf(payload.currentId) : -1;
  return {
    track_ids: payload.trackIds,
    current_index: index >= 0 ? index : null,
    position_s: index >= 0 ? payload.positionS : 0,
  };
}

/**
 * Rebuilds the saved queue from the row and the tracks still in the
 * library (deleted ones are skipped). If the loaded track was deleted,
 * the queue starts from the beginning.
 */
export function toSavedQueue(
  row: Pick<QueueStateRow, "track_ids" | "current_index" | "position_s">,
  tracks: readonly Track[],
): SavedQueue {
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const ordered = row.track_ids.flatMap((id) => {
    const track = byId.get(id);
    return track ? [track] : [];
  });
  const savedCurrent = row.current_index === null ? undefined : row.track_ids[row.current_index];
  const currentId = savedCurrent && byId.has(savedCurrent) ? savedCurrent : null;
  return {
    tracks: ordered,
    currentId,
    positionS: currentId ? Number(row.position_s) : 0,
  };
}
