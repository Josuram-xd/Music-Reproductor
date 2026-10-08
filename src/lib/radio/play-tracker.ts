import { UUID } from "@/lib/library/folders";
import type { PlayerSnapshot } from "@/lib/player/player-engine";
import type { Track, TrackSource } from "@/lib/player/types";

/** Leaving a track before this many seconds counts as a skip (a "no" for the radio). */
export const SKIP_THRESHOLD_S = 30;
/** Listening to this fraction of a track counts as complete. */
export const COMPLETE_RATIO = 0.9;
/** Plays shorter than this are not worth recording. */
export const MIN_LISTEN_S = 1;
/** Bigger jumps between two time updates are seeks, not listening. */
const MAX_TICK_S = 2.5;
/** Within this many seconds of the end, the track reached its end. */
const END_MARGIN_S = 1.5;

/** One play, as sent to `POST /api/play-events`. */
export interface PlayEventInput {
  /** Library track id (uuid), or null for YouTube/Spotify results. */
  trackId: string | null;
  source: TrackSource;
  externalId: string | null;
  title: string;
  artist: string | null;
  startedAt: string;
  listenedS: number;
  completed: boolean;
  skipped: boolean;
  fromRadio: boolean;
}

type Snapshot = Pick<PlayerSnapshot, "current" | "state" | "time" | "duration">;

/**
 * Turns the stream of player snapshots into play events: how long each
 * track was really listened to (seeks do not count), whether it was
 * completed, and whether it was skipped in the first 30 s.
 */
export class PlayTracker {
  private track: Track | null = null;
  private startedAt = 0;
  private listened = 0;
  private lastTime = 0;
  private lastState: Snapshot["state"] = "idle";
  private duration = 0;
  private reachedEnd = false;
  /** It actually sounded (a restored, never-played track is not a skip). */
  private played = false;

  /** Feeds a snapshot; returns the event of a track that just finished, if any. */
  update(snapshot: Snapshot, now: number): PlayEventInput | null {
    if (snapshot.current?.id !== this.track?.id) {
      const finished = this.close({ canSkip: true });
      this.start(snapshot, now);
      return finished;
    }
    if (!this.track) return null;

    // Repeat-one: the same track starts again after its end.
    if (this.reachedEnd && snapshot.time < 1 && snapshot.state === "playing") {
      const finished = this.close({ canSkip: true });
      this.start(snapshot, now);
      return finished;
    }

    const delta = snapshot.time - this.lastTime;
    const playing = snapshot.state === "playing" || this.lastState === "playing";
    if (playing && delta > 0 && delta <= MAX_TICK_S) this.listened += delta;
    this.lastTime = snapshot.time;
    this.lastState = snapshot.state;
    if (snapshot.state === "playing") this.played = true;
    if (snapshot.duration > 0) this.duration = snapshot.duration;
    if (
      snapshot.state === "ended" ||
      (this.duration > 0 && snapshot.time >= this.duration - END_MARGIN_S)
    ) {
      this.reachedEnd = true;
    }
    return null;
  }

  /**
   * Closes the current play (the page is going away). Not a skip: the user
   * left the app, they did not reject the track.
   */
  flush(): PlayEventInput | null {
    const finished = this.close({ canSkip: false });
    this.track = null;
    return finished;
  }

  private start(snapshot: Snapshot, now: number): void {
    this.track = snapshot.current;
    this.startedAt = now;
    this.listened = 0;
    this.lastTime = snapshot.time;
    this.lastState = snapshot.state;
    this.duration = snapshot.duration;
    this.reachedEnd = false;
    this.played = snapshot.state === "playing";
  }

  private close({ canSkip }: { canSkip: boolean }): PlayEventInput | null {
    const track = this.track;
    if (!track || !this.played) return null;
    // Very short plays only matter as skips (left almost at once).
    if (this.listened < MIN_LISTEN_S && (!canSkip || this.reachedEnd)) return null;
    const completed =
      this.reachedEnd || (this.duration > 0 && this.listened >= this.duration * COMPLETE_RATIO);
    return {
      trackId: UUID.test(track.id) ? track.id : null,
      source: track.source,
      externalId: track.externalId ?? null,
      title: track.title,
      artist: track.artist ?? null,
      startedAt: new Date(this.startedAt).toISOString(),
      listenedS: Math.round(this.listened * 10) / 10,
      completed,
      skipped: canSkip && !completed && this.listened < SKIP_THRESHOLD_S,
      fromRadio: track.radio === true,
    };
  }
}

const SOURCES: readonly TrackSource[] = ["audio", "youtube", "spotify"];
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/** Validates a play event from the client, or `null`. */
export function parsePlayEvent(body: unknown, now = Date.now()): PlayEventInput | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const source = SOURCES.find((s) => s === raw.source);
  const title = text(raw.title, 300);
  const listened = Number(raw.listenedS);
  if (!source || !title || !Number.isFinite(listened) || listened < 0 || listened > 86_400) {
    return null;
  }
  const trackId = typeof raw.trackId === "string" && UUID.test(raw.trackId) ? raw.trackId : null;
  const started = typeof raw.startedAt === "string" ? Date.parse(raw.startedAt) : NaN;
  const startedAt =
    Number.isFinite(started) && started <= now && now - started <= MAX_AGE_MS ? started : now;
  return {
    trackId,
    source,
    externalId: text(raw.externalId, 200),
    title,
    artist: text(raw.artist, 300),
    startedAt: new Date(startedAt).toISOString(),
    listenedS: listened,
    completed: raw.completed === true,
    skipped: raw.skipped === true && raw.completed !== true,
    fromRadio: raw.fromRadio === true,
  };
}
