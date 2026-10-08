import { vi } from "vitest";
import { Emitter } from "./emitter";
import type {
  PlaybackError,
  PlaybackEvents,
  PlaybackSource,
  PlaybackState,
  Track,
  TrackSource,
} from "./types";

/** In-memory PlaybackSource: loads instantly and lets tests drive time/end. */
export class FakeSource implements PlaybackSource {
  readonly events = new Emitter<PlaybackEvents>();
  state: PlaybackState = "idle";
  time = 0;
  duration = 0;
  volume = 1;
  loaded: Track | null = null;
  playError: PlaybackError | null = null;
  loadError: PlaybackError | null = null;
  /** When set, load() waits for this promise (to test races). */
  loadGate: Promise<void> | null = null;

  constructor(readonly kind: TrackSource = "audio") {}

  canPlay(track: Track) {
    return track.source === this.kind;
  }
  async load(track: Track) {
    this.setState("loading");
    if (this.loadGate) await this.loadGate;
    if (this.loadError) {
      this.setState("error");
      this.events.emit("error", this.loadError);
      throw this.loadError;
    }
    this.loaded = track;
    this.time = 0;
    this.duration = track.durationS ?? 100;
    this.setState("paused");
  }
  async play() {
    if (this.playError) {
      this.setState("error");
      throw this.playError;
    }
    this.setState("playing");
  }
  pause() {
    if (this.state === "playing") this.setState("paused");
  }
  seek(seconds: number) {
    this.time = Math.min(Math.max(0, seconds), this.duration);
    if (this.state === "ended") this.setState("paused");
    this.events.emit("time", { current: this.time, duration: this.duration });
  }
  getTime() {
    return this.time;
  }
  getDuration() {
    return this.duration;
  }
  getState() {
    return this.state;
  }
  setVolume(volume: number) {
    this.volume = volume;
  }
  activateAudio = vi.fn();
  on<E extends keyof PlaybackEvents>(event: E, listener: (p: PlaybackEvents[E]) => void) {
    return this.events.on(event, listener);
  }
  destroy = vi.fn();

  /** Test helpers */
  setState(state: PlaybackState) {
    this.state = state;
    this.events.emit("state", state);
  }
  advanceTo(seconds: number) {
    this.time = seconds;
    this.events.emit("time", { current: seconds, duration: this.duration });
  }
  finish() {
    this.time = this.duration;
    this.setState("ended");
    this.events.emit("ended", undefined);
  }
}
