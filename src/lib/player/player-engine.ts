import { CircularDoublyLinkedList } from "@/lib/ds/circular-doubly-linked-list";
import { Stack } from "@/lib/ds/stack";
import { Emitter } from "./emitter";
import { PlaybackError, type PlaybackSource, type PlaybackState, type Track } from "./types";

export type RepeatMode = "off" | "all" | "one";

/** Immutable view of the player for the UI. */
export interface PlayerSnapshot {
  current: Track | null;
  queue: readonly Track[];
  state: PlaybackState;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  /** There is an earlier track to go back to (history or queue). */
  hasPrevious: boolean;
  hasNext: boolean;
}

/** What `back()` did: restarted the track, went to the previous one, or there was none. */
export type BackResult = "restarted" | "previous" | "first";

/** Above this position, ⏮ restarts the track instead of going back. */
export const RESTART_THRESHOLD_S = 3;
/** A second ⏮ within this window goes to the previous track. */
export const DOUBLE_BACK_WINDOW_MS = 1500;
export const SEEK_STEP_S = 10;
const HISTORY_LIMIT = 100;

interface PlayerEngineOptions {
  sources: PlaybackSource[];
  /** Clock, injectable for tests. */
  now?: () => number;
}

interface PlayerEvents {
  change: PlayerSnapshot;
  error: PlaybackError;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Plays a queue of tracks through the right `PlaybackSource`.
 * The queue is a circular doubly linked list (repeat-all wraps around) and
 * the history a stack (double back). UI code subscribes to snapshots.
 */
export class PlayerEngine {
  private readonly sources: PlaybackSource[];
  private readonly now: () => number;
  private readonly queue = new CircularDoublyLinkedList<Track>((track) => track.id);
  private readonly history = new Stack<string>(HISTORY_LIMIT);
  private readonly events = new Emitter<PlayerEvents>();
  private readonly detach: (() => void)[] = [];

  private source: PlaybackSource | null = null;
  private currentId: string | null = null;
  private state: PlaybackState = "idle";
  private time = 0;
  private duration = 0;
  private volume = 1;
  private muted = false;
  private repeat: RepeatMode = "off";
  /** The user asked to play (vs. pause); new tracks start on their own while true. */
  private wantsToPlay = false;
  private lastBackAt = -Infinity;
  /** Increases on every track change, so a slow load cannot override a newer one. */
  private loadToken = 0;
  private queueCache: readonly Track[] = [];
  private snapshot: PlayerSnapshot;

  constructor({ sources, now = Date.now }: PlayerEngineOptions) {
    this.sources = sources;
    this.now = now;
    for (const source of sources) {
      source.setVolume(this.volume);
      this.detach.push(
        source.on("time", ({ current, duration }) => {
          if (source !== this.source) return;
          this.time = current;
          if (duration > 0) this.duration = duration;
          this.publish();
        }),
        source.on("state", (state) => {
          if (source !== this.source) return;
          this.state = state;
          this.publish();
        }),
        source.on("ended", () => {
          if (source === this.source) void this.handleEnded();
        }),
        source.on("error", (error) => {
          if (source === this.source) this.events.emit("error", error);
        }),
      );
    }
    this.snapshot = this.buildSnapshot();
  }

  getSnapshot(): PlayerSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: PlayerSnapshot) => void): () => void {
    return this.events.on("change", listener);
  }

  onError(listener: (error: PlaybackError) => void): () => void {
    return this.events.on("error", listener);
  }

  // ── Queue ────────────────────────────────────────────────────────────

  /** Replaces the queue and loads `startId` (or the first track). Duplicates are skipped. */
  async setQueue(
    tracks: readonly Track[],
    { startId, autoplay = true }: { startId?: string; autoplay?: boolean } = {},
  ): Promise<void> {
    this.queue.clear();
    for (const track of tracks) if (!this.queue.has(track.id)) this.queue.append(track);
    this.history.clear();
    this.queueChanged();

    const start = startId && this.queue.has(startId) ? startId : this.queue.first?.id;
    if (!start) return this.stop();
    this.wantsToPlay = autoplay;
    await this.loadTrack(start);
  }

  /** Adds a track at the end. Returns false if it was already queued. */
  enqueue(track: Track): boolean {
    if (this.queue.has(track.id)) return false;
    this.queue.append(track);
    this.queueChanged();
    this.publish();
    return true;
  }

  // ── Transport ────────────────────────────────────────────────────────

  async play(): Promise<void> {
    this.wantsToPlay = true;
    if (!this.source || !this.currentId) {
      const first = this.queue.first;
      if (first) await this.loadTrack(first.id);
      return;
    }
    if (this.state === "ended") this.source.seek(0);
    await this.startSource();
  }

  pause(): void {
    this.wantsToPlay = false;
    this.source?.pause();
  }

  async toggle(): Promise<void> {
    if (this.wantsToPlay && (this.state === "playing" || this.state === "loading")) this.pause();
    else await this.play();
  }

  /** Next track (wraps with repeat-all). Returns false at the end of the queue. */
  async next(): Promise<boolean> {
    const id = this.nextId();
    if (!id) return false;
    this.pushHistory();
    await this.loadTrack(id);
    return true;
  }

  /**
   * Double back: past 3 s the first press restarts the track; a second press
   * within 1.5 s (or a press in the first 3 s) goes to the previous track,
   * taken from the history stack, or else from the queue.
   */
  async back(): Promise<BackResult> {
    const now = this.now();
    const quickSecondPress = now - this.lastBackAt < DOUBLE_BACK_WINDOW_MS;
    this.lastBackAt = now;

    if (this.currentId && this.time > RESTART_THRESHOLD_S && !quickSecondPress) {
      this.seek(0);
      return "restarted";
    }
    const previous = this.popHistory() ?? this.queuePreviousId();
    if (!previous) return "first";
    await this.loadTrack(previous);
    return "previous";
  }

  seek(seconds: number): void {
    this.source?.seek(seconds);
  }

  seekBy(deltaSeconds: number): void {
    if (this.source) this.seek(this.source.getTime() + deltaSeconds);
  }

  setVolume(volume: number): void {
    this.volume = clamp01(Number.isFinite(volume) ? volume : 1);
    this.muted = this.volume === 0;
    this.applyVolume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (!this.muted && this.volume === 0) this.volume = 0.5;
    this.applyVolume();
  }

  setRepeat(mode: RepeatMode): void {
    this.repeat = mode;
    this.publish();
  }

  /** off → all → one → off */
  cycleRepeat(): RepeatMode {
    const order: RepeatMode[] = ["off", "all", "one"];
    this.setRepeat(order[(order.indexOf(this.repeat) + 1) % order.length]!);
    return this.repeat;
  }

  destroy(): void {
    this.loadToken++;
    for (const off of this.detach) off();
    for (const source of this.sources) source.destroy();
    this.events.clear();
  }

  // ── Internals ────────────────────────────────────────────────────────

  private async loadTrack(id: string): Promise<void> {
    const track = this.queue.get(id);
    if (!track) return;
    const token = ++this.loadToken;
    const source = this.sources.find((candidate) => candidate.canPlay(track)) ?? null;
    if (this.source && this.source !== source) this.source.pause();

    this.source = source;
    this.currentId = id;
    this.time = 0;
    this.duration = track.durationS ?? 0;

    if (!source) {
      this.state = "error";
      this.publish();
      this.events.emit(
        "error",
        new PlaybackError("unsupported", `No source can play "${track.title}"`),
      );
      return;
    }

    this.state = "loading";
    this.publish();
    try {
      await source.load(track);
    } catch {
      // The source already emitted the error and set its state.
      if (token === this.loadToken) {
        this.state = "error";
        this.publish();
      }
      return;
    }
    if (token !== this.loadToken) return;

    this.state = source.getState();
    this.duration = source.getDuration() || this.duration;
    this.publish();
    if (this.wantsToPlay) await this.startSource();
  }

  private async startSource(): Promise<void> {
    const source = this.source;
    if (!source) return;
    try {
      await source.play();
    } catch (error) {
      if (source !== this.source) return;
      this.wantsToPlay = false;
      // Autoplay blocked: nothing is broken, the user just has to press play.
      if (error instanceof PlaybackError && error.code === "not-allowed") {
        this.state = "paused";
        this.publish();
      }
    }
  }

  private async handleEnded(): Promise<void> {
    if (this.repeat === "one") {
      this.source?.seek(0);
      await this.startSource();
      return;
    }
    const id = this.nextId();
    if (!id) {
      this.wantsToPlay = false;
      this.publish();
      return;
    }
    this.pushHistory();
    await this.loadTrack(id);
  }

  private stop(): void {
    this.loadToken++;
    this.source?.pause();
    this.source = null;
    this.currentId = null;
    this.wantsToPlay = false;
    this.state = "idle";
    this.time = 0;
    this.duration = 0;
    this.publish();
  }

  private nextId(): string | null {
    if (!this.currentId) return this.queue.first?.id ?? null;
    if (this.currentId === this.queue.last?.id) {
      return this.repeat === "all" ? (this.queue.first?.id ?? null) : null;
    }
    return this.queue.nextOf(this.currentId)?.id ?? null;
  }

  private queuePreviousId(): string | null {
    if (!this.currentId) return null;
    if (this.currentId === this.queue.first?.id) {
      return this.repeat === "all" && this.queue.size > 1 ? (this.queue.last?.id ?? null) : null;
    }
    return this.queue.prevOf(this.currentId)?.id ?? null;
  }

  private pushHistory(): void {
    if (this.currentId && this.history.peek() !== this.currentId) this.history.push(this.currentId);
  }

  /** Pops until it finds a track that is still in the queue. */
  private popHistory(): string | null {
    for (let id = this.history.pop(); id !== undefined; id = this.history.pop()) {
      if (id !== this.currentId && this.queue.has(id)) return id;
    }
    return null;
  }

  private applyVolume(): void {
    for (const source of this.sources) source.setVolume(this.muted ? 0 : this.volume);
    this.publish();
  }

  private queueChanged(): void {
    this.queueCache = this.queue.toArray();
  }

  private buildSnapshot(): PlayerSnapshot {
    const hasHistory = this.history
      .toArray()
      .some((id) => id !== this.currentId && this.queue.has(id));
    return {
      current: this.currentId ? (this.queue.get(this.currentId) ?? null) : null,
      queue: this.queueCache,
      state: this.state,
      time: this.time,
      duration: this.duration,
      volume: this.volume,
      muted: this.muted,
      repeat: this.repeat,
      hasPrevious: hasHistory || this.queuePreviousId() !== null,
      hasNext: this.nextId() !== null,
    };
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    this.events.emit("change", this.snapshot);
  }
}
