import { Emitter } from "./emitter";
import {
  PlaybackError,
  type PlaybackEvents,
  type PlaybackSource,
  type PlaybackState,
  type Track,
} from "./types";

export interface LocalAudioSourceOptions {
  /** Turns a track into a playable URL (e.g. a signed Storage URL, cached). */
  resolveUrl: (track: Track) => Promise<string>;
  /** Injectable for tests; defaults to `new Audio()`. */
  createAudio?: () => HTMLAudioElement;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function mediaError(error: MediaError | null): PlaybackError {
  switch (error?.code) {
    case 2: // MEDIA_ERR_NETWORK
      return new PlaybackError("network", "The audio could not be downloaded");
    case 3: // MEDIA_ERR_DECODE
      return new PlaybackError("decode", "The audio file is corrupt or unsupported");
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      return new PlaybackError("unsupported", "This audio format is not supported");
    default:
      return new PlaybackError("unknown", error?.message || "Audio playback failed");
  }
}

/** Plays uploaded files (`source = 'audio'`) through an `HTMLAudioElement`. */
export class LocalAudioSource implements PlaybackSource {
  readonly kind = "audio" as const;
  private readonly audio: HTMLAudioElement;
  private readonly events = new Emitter<PlaybackEvents>();
  private readonly resolveUrl: (track: Track) => Promise<string>;
  private state: PlaybackState = "idle";
  /** Increases on every load so a slow, outdated load cannot win the race. */
  private loadId = 0;
  private readonly detach: () => void;

  constructor({ resolveUrl, createAudio = () => new Audio() }: LocalAudioSourceOptions) {
    this.resolveUrl = resolveUrl;
    this.audio = createAudio();
    this.audio.preload = "auto";

    const handlers: [string, () => void][] = [
      ["timeupdate", () => this.emitTime()],
      ["durationchange", () => this.emitTime()],
      ["playing", () => this.setState("playing")],
      [
        "pause",
        () => this.state !== "ended" && this.state !== "loading" && this.setState("paused"),
      ],
      ["waiting", () => this.state === "playing" && this.setState("loading")],
      [
        "ended",
        () => {
          this.setState("ended");
          this.events.emit("ended", undefined);
        },
      ],
      [
        "error",
        () => {
          // Errors from an emptied source (load/destroy) are not real failures.
          if (!this.audio.getAttribute("src")) return;
          this.fail(mediaError(this.audio.error));
        },
      ],
    ];
    for (const [type, handler] of handlers) this.audio.addEventListener(type, handler);
    this.detach = () => {
      for (const [type, handler] of handlers) this.audio.removeEventListener(type, handler);
    };
  }

  canPlay(track: Track): boolean {
    return track.source === "audio" && Boolean(track.storagePath);
  }

  async load(track: Track): Promise<void> {
    if (!this.canPlay(track)) {
      throw this.fail(new PlaybackError("unsupported", `Cannot play "${track.title}" here`));
    }
    const id = ++this.loadId;
    this.audio.pause();
    this.setState("loading");

    let url: string;
    try {
      url = await this.resolveUrl(track);
    } catch (error) {
      if (id !== this.loadId) return;
      throw this.fail(
        new PlaybackError("network", `Could not get a URL for "${track.title}"`, { cause: error }),
      );
    }
    if (id !== this.loadId) return; // a newer load() took over

    await new Promise<void>((resolve, reject) => {
      const done = () => {
        this.audio.removeEventListener("loadedmetadata", onReady);
        this.audio.removeEventListener("error", onError);
      };
      const onReady = () => {
        done();
        resolve();
      };
      const onError = () => {
        done();
        reject(mediaError(this.audio.error));
      };
      this.audio.addEventListener("loadedmetadata", onReady);
      this.audio.addEventListener("error", onError);
      this.audio.src = url;
      this.audio.load();
    });
    if (id !== this.loadId) return;

    this.setState("paused");
    this.emitTime();
  }

  async play(): Promise<void> {
    try {
      await this.audio.play();
    } catch (error) {
      const notAllowed = error instanceof DOMException && error.name === "NotAllowedError";
      throw this.fail(
        notAllowed
          ? new PlaybackError("not-allowed", "The browser blocked playback", { cause: error })
          : new PlaybackError("unknown", "Playback could not start", { cause: error }),
      );
    }
  }

  pause(): void {
    this.audio.pause();
  }

  seek(seconds: number): void {
    const duration = this.getDuration();
    const target = duration > 0 ? clamp(seconds, 0, duration) : Math.max(0, seconds);
    this.audio.currentTime = target;
    if (this.state === "ended" && target < duration) this.setState("paused");
    this.emitTime();
  }

  getTime(): number {
    return this.audio.currentTime || 0;
  }

  getDuration(): number {
    const duration = this.audio.duration;
    return Number.isFinite(duration) ? duration : 0;
  }

  getState(): PlaybackState {
    return this.state;
  }

  setVolume(volume: number): void {
    this.audio.volume = clamp(Number.isFinite(volume) ? volume : 1, 0, 1);
  }

  on<E extends keyof PlaybackEvents>(
    event: E,
    listener: (payload: PlaybackEvents[E]) => void,
  ): () => void {
    return this.events.on(event, listener);
  }

  destroy(): void {
    this.loadId++;
    this.detach();
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.state = "idle";
    this.events.clear();
  }

  private setState(state: PlaybackState): void {
    if (state === this.state) return;
    this.state = state;
    this.events.emit("state", state);
  }

  private emitTime(): void {
    this.events.emit("time", { current: this.getTime(), duration: this.getDuration() });
  }

  private fail(error: PlaybackError): PlaybackError {
    this.setState("error");
    this.events.emit("error", error);
    return error;
  }
}
