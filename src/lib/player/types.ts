export type TrackSource = "audio" | "youtube" | "spotify";

/** What the player needs to know about a track (subset of the `tracks` table). */
export interface Track {
  id: string;
  source: TrackSource;
  title: string;
  artist?: string | null;
  durationS?: number | null;
  /** Object path in the `media` bucket (`source = 'audio'`). */
  storagePath?: string | null;
  /** YouTube video id or Spotify URI. */
  externalId?: string | null;
}

export type PlaybackState = "idle" | "loading" | "paused" | "playing" | "ended" | "error";

export interface PlaybackEvents {
  /** Playback position changed (seconds). */
  time: { current: number; duration: number };
  /** The track finished on its own. */
  ended: void;
  error: PlaybackError;
  state: PlaybackState;
}

export type PlaybackErrorCode =
  | "unsupported" // this source cannot play the track
  | "not-allowed" // the browser blocked playback (autoplay policy)
  | "network"
  | "decode"
  | "unknown";

export class PlaybackError extends Error {
  constructor(
    readonly code: PlaybackErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PlaybackError";
  }
}

/**
 * Adapter over a concrete player (HTML audio, YouTube IFrame, Spotify SDK).
 * The PlayerEngine only talks to this interface (docs/ARCHITECTURE.md).
 */
export interface PlaybackSource {
  readonly kind: TrackSource;
  /** Whether this source can play `track`. */
  canPlay(track: Track): boolean;
  /** Prepares `track` (paused at 0). Resolves when its metadata is ready. */
  load(track: Track): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  /** Jumps to `seconds`, clamped to the track length. */
  seek(seconds: number): void;
  getTime(): number;
  /** Track length in seconds (0 while unknown). */
  getDuration(): number;
  getState(): PlaybackState;
  /** Volume from 0 to 1. */
  setVolume(volume: number): void;
  /** Subscribes to an event; returns the unsubscribe function. */
  on<E extends keyof PlaybackEvents>(
    event: E,
    listener: (payload: PlaybackEvents[E]) => void,
  ): () => void;
  /** Stops playback and releases the underlying player. */
  destroy(): void;
}
