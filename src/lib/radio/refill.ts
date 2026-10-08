/** Refill when this many tracks (or fewer) are left after the current one. */
export const REFILL_THRESHOLD = 1;
/** How many recommendations each refill adds. */
export const REFILL_COUNT = 5;
/** Minimum time between two refills. */
export const REFILL_COOLDOWN_MS = 20_000;
/** After an empty answer or an error, wait longer before trying again. */
export const REFILL_BACKOFF_MS = 5 * 60_000;

export interface RefillState {
  enabled: boolean;
  /** Something is loaded (the radio continues a session, it does not start one). */
  hasCurrent: boolean;
  upNextCount: number;
  inFlight: boolean;
  /** When the next attempt is allowed (epoch ms). */
  notBefore: number;
  now: number;
}

/** Whether the neko radio should add recommendations now. */
export function shouldRefill(state: RefillState): boolean {
  return (
    state.enabled &&
    state.hasCurrent &&
    !state.inFlight &&
    state.upNextCount <= REFILL_THRESHOLD &&
    state.now >= state.notBefore
  );
}

/** When to allow the next attempt after one that added `added` tracks (or failed). */
export function nextAttemptAt(now: number, added: number | null): number {
  return now + (added ? REFILL_COOLDOWN_MS : REFILL_BACKOFF_MS);
}
