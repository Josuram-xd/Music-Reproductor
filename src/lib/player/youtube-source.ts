import { Emitter } from "./emitter";
import {
  PlaybackError,
  type PlaybackEvents,
  type PlaybackSource,
  type PlaybackState,
  type Track,
} from "./types";

// ── Minimal typing of the YouTube IFrame Player API ────────────────────────

export interface YTPlayer {
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getIframe(): HTMLIFrameElement;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  destroy(): void;
}

interface YTPlayerOptions {
  width: string;
  height: string;
  playerVars: Record<string, string | number>;
  events: {
    onReady: (event: { target: YTPlayer }) => void;
    onStateChange: (event: { data: number }) => void;
    onError: (event: { data: number }) => void;
  };
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

/** `YT.PlayerState` values. */
const YT_STATE = { ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads https://www.youtube.com/iframe_api once (on the first YouTube track). */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new PlaybackError("network", "The YouTube player could not be loaded"));
    };
    document.head.append(script);
  });
  return apiPromise;
}

/** IFrame API error codes → our errors. */
function youtubeError(code: number): PlaybackError {
  switch (code) {
    case 5:
      return new PlaybackError("decode", "YouTube could not play this video in HTML5");
    case 100:
      return new PlaybackError("unsupported", "The video was removed or is private");
    case 101:
    case 150:
      return new PlaybackError("unsupported", "The owner does not allow embedding this video");
    default:
      return new PlaybackError("unsupported", `YouTube player error ${code}`);
  }
}

export interface YouTubeSourceOptions {
  /** Element the (visible) player lives in; the UI docks it in "Ahora suena". */
  getHost: () => HTMLElement;
  /** Injectable for tests. */
  loadApi?: () => Promise<YTNamespace>;
  /** How often the position is reported while playing (the API has no time event). */
  pollMs?: number;
  /** Give up waiting for a video to be cued after this long (it still plays). */
  cueTimeoutMs?: number;
}

/**
 * Plays YouTube videos (`source = 'youtube'`) with the official IFrame
 * Player API. The video stays visible (YouTube ToS): the player is created
 * once inside `getHost()` and reused for every video.
 */
export class YouTubeSource implements PlaybackSource {
  readonly kind = "youtube" as const;
  private readonly events = new Emitter<PlaybackEvents>();
  private readonly getHost: () => HTMLElement;
  private readonly loadApi: () => Promise<YTNamespace>;
  private readonly pollMs: number;
  private readonly cueTimeoutMs: number;
  private playerPromise: Promise<YTPlayer> | null = null;
  private player: YTPlayer | null = null;
  private state: PlaybackState = "idle";
  private time = 0;
  private duration = 0;
  private volume = 1;
  private poll: ReturnType<typeof setInterval> | null = null;
  /** Settles the pending `load()` once the video is cued (or fails). */
  private pendingCue: { resolve: () => void; reject: (error: PlaybackError) => void } | null = null;
  private loadId = 0;

  constructor({
    getHost,
    loadApi = loadYouTubeIframeApi,
    pollMs = 250,
    cueTimeoutMs = 8000,
  }: YouTubeSourceOptions) {
    this.getHost = getHost;
    this.loadApi = loadApi;
    this.pollMs = pollMs;
    this.cueTimeoutMs = cueTimeoutMs;
  }

  canPlay(track: Track): boolean {
    return track.source === "youtube" && Boolean(track.externalId);
  }

  async load(track: Track): Promise<void> {
    const id = ++this.loadId;
    this.stopPolling();
    this.settleCue();
    this.time = 0;
    this.duration = track.durationS ?? 0;
    this.setState("loading");

    let player: YTPlayer;
    try {
      player = await this.ensurePlayer();
    } catch (error) {
      if (id !== this.loadId) return;
      const failure =
        error instanceof PlaybackError
          ? error
          : new PlaybackError("network", "The YouTube player could not be loaded", {
              cause: error,
            });
      this.fail(failure);
      throw failure;
    }
    if (id !== this.loadId) return;

    const cued = new Promise<void>((resolve, reject) => {
      this.pendingCue = { resolve, reject };
    });
    const timeout = setTimeout(() => this.settleCue(), this.cueTimeoutMs);
    player.cueVideoById(track.externalId!);
    try {
      await cued;
    } finally {
      clearTimeout(timeout);
    }
    if (id !== this.loadId) return;
    this.duration = player.getDuration() || this.duration;
    if (this.state === "loading") this.setState("paused");
    this.emitTime();
  }

  async play(): Promise<void> {
    this.activateAudio();
  }

  activateAudio(): void {
    const player = this.player;
    if (!player) return;
    this.applyVolume(player);
    player.unMute();
    player.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    if (!this.player) return;
    const max = this.duration > 0 ? this.duration : Infinity;
    this.time = Math.min(Math.max(0, seconds), max);
    this.player.seekTo(this.time, true);
    if (this.state === "ended") this.setState("paused");
    this.emitTime();
  }

  getTime(): number {
    return this.player?.getCurrentTime() ?? this.time;
  }

  getDuration(): number {
    return this.duration;
  }

  getState(): PlaybackState {
    return this.state;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.player) this.applyVolume(this.player);
  }

  on<E extends keyof PlaybackEvents>(
    event: E,
    listener: (payload: PlaybackEvents[E]) => void,
  ): () => void {
    return this.events.on(event, listener);
  }

  destroy(): void {
    this.loadId++;
    this.stopPolling();
    this.settleCue();
    this.player?.destroy();
    this.player = null;
    this.playerPromise = null;
    this.events.clear();
  }

  // ── Internals ────────────────────────────────────────────────────────

  private ensurePlayer(): Promise<YTPlayer> {
    this.playerPromise ??= this.loadApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          const element = document.createElement("div");
          this.getHost().append(element);
          new YT.Player(element, {
            width: "100%",
            height: "100%",
            playerVars: { playsinline: 1, rel: 0, controls: 1, origin: window.location.origin },
            events: {
              onReady: ({ target }) => {
                this.player = target;
                target.getIframe().allow = "autoplay; encrypted-media; picture-in-picture";
                this.applyVolume(target);
                resolve(target);
              },
              onStateChange: ({ data }) => this.handleState(data),
              onError: ({ data }) => this.fail(youtubeError(data)),
            },
          });
        }),
    );
    this.playerPromise.catch(() => {
      this.playerPromise = null;
    });
    return this.playerPromise;
  }

  private handleState(code: number): void {
    switch (code) {
      case YT_STATE.cued:
        this.settleCue();
        if (this.state !== "error") this.setState("paused");
        return;
      case YT_STATE.playing:
        this.settleCue();
        this.duration = this.player?.getDuration() || this.duration;
        this.setState("playing");
        this.startPolling();
        return;
      case YT_STATE.paused:
        this.stopPolling();
        this.setState("paused");
        this.emitTime();
        return;
      case YT_STATE.buffering:
        if (this.state === "playing") this.setState("loading");
        return;
      case YT_STATE.ended:
        this.stopPolling();
        this.time = this.duration;
        this.setState("ended");
        this.events.emit("ended", undefined);
        return;
      default:
        // -1 (unstarted): nothing to report.
        return;
    }
  }

  private fail(error: PlaybackError): void {
    this.stopPolling();
    const pending = this.pendingCue;
    this.pendingCue = null;
    this.setState("error");
    this.events.emit("error", error);
    pending?.reject(error);
  }

  private settleCue(): void {
    const pending = this.pendingCue;
    this.pendingCue = null;
    pending?.resolve();
  }

  private startPolling(): void {
    this.stopPolling();
    this.emitTime();
    this.poll = setInterval(() => this.emitTime(), this.pollMs);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  private emitTime(): void {
    if (this.player) this.time = this.player.getCurrentTime();
    this.events.emit("time", { current: this.time, duration: this.duration });
  }

  private applyVolume(player: YTPlayer): void {
    player.setVolume(Math.round(this.volume * 100));
    if (this.volume === 0) player.mute();
    else player.unMute();
  }

  private setState(state: PlaybackState): void {
    if (state === this.state) return;
    this.state = state;
    this.events.emit("state", state);
  }
}
