import { Emitter } from "./emitter";
import {
  PlaybackError,
  type PlaybackEvents,
  type PlaybackSource,
  type PlaybackState,
  type Track,
} from "./types";

// ── Minimal typing of the Spotify Web Playback SDK ─────────────────────────

export interface SpotifyPlayerState {
  paused: boolean;
  /** Milliseconds. */
  position: number;
  duration: number;
  track_window: { current_track: { uri: string } | null };
}

type ErrorEvent =
  "initialization_error" | "authentication_error" | "account_error" | "playback_error";

export interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: "ready" | "not_ready", cb: (e: { device_id: string }) => void): boolean;
  addListener(
    event: "player_state_changed",
    cb: (state: SpotifyPlayerState | null) => void,
  ): boolean;
  addListener(event: ErrorEvent, cb: (e: { message: string }) => void): boolean;
  getCurrentState(): Promise<SpotifyPlayerState | null>;
  resume(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  /** Unlocks audio on mobile; must run inside a user gesture. */
  activateElement?(): Promise<void>;
}

export interface SpotifyNamespace {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume: number;
  }) => SpotifyPlayer;
}

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let sdkPromise: Promise<SpotifyNamespace> | null = null;

/** Loads https://sdk.scdn.co/spotify-player.js once (on the first Spotify track). */
export function loadSpotifySdk(): Promise<SpotifyNamespace> {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  sdkPromise ??= new Promise<SpotifyNamespace>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (window.Spotify) resolve(window.Spotify);
    };
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => {
      sdkPromise = null;
      reject(new PlaybackError("network", "The Spotify player could not be loaded"));
    };
    document.head.append(script);
  });
  return sdkPromise;
}

const API = "https://api.spotify.com/v1";
/** A track "ended" if it stopped at 0 after being this close (ms) to its end. */
const END_TOLERANCE_MS = 2500;

export interface SpotifySourceOptions {
  /** A valid access token (from our server; the refresh token never reaches the browser). */
  getToken: () => Promise<string>;
  loadSdk?: () => Promise<SpotifyNamespace>;
  fetcher?: typeof fetch;
  pollMs?: number;
  readyTimeoutMs?: number;
}

/**
 * Plays Spotify tracks (`source = 'spotify'`, `externalId` = track URI) in
 * the browser with the Web Playback SDK (Premium only; audio only). The
 * browser becomes a Spotify Connect device and the Web API tells it what
 * to play. The SDK has no "ended" event: it is inferred from the state.
 */
export class SpotifySource implements PlaybackSource {
  readonly kind = "spotify" as const;
  private readonly events = new Emitter<PlaybackEvents>();
  private readonly options: Required<Omit<SpotifySourceOptions, "loadSdk" | "fetcher">> & {
    loadSdk: () => Promise<SpotifyNamespace>;
    fetcher: typeof fetch;
  };
  private device: Promise<{ player: SpotifyPlayer; deviceId: string }> | null = null;
  private player: SpotifyPlayer | null = null;
  private state: PlaybackState = "idle";
  private uri: string | null = null;
  /** The URI was sent to the device (later plays just resume). */
  private started = false;
  private pendingPositionS = 0;
  private time = 0;
  private duration = 0;
  private lastPositionMs = 0;
  private volume = 1;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor({
    getToken,
    loadSdk = loadSpotifySdk,
    fetcher = (...args) => fetch(...args),
    pollMs = 500,
    readyTimeoutMs = 10_000,
  }: SpotifySourceOptions) {
    this.options = { getToken, loadSdk, fetcher, pollMs, readyTimeoutMs };
  }

  canPlay(track: Track): boolean {
    return track.source === "spotify" && Boolean(track.externalId?.startsWith("spotify:"));
  }

  async load(track: Track): Promise<void> {
    if (this.started && this.state === "playing") void this.player?.pause();
    this.stopPolling();
    this.uri = track.externalId!;
    this.started = false;
    this.pendingPositionS = 0;
    this.time = 0;
    this.lastPositionMs = 0;
    this.duration = track.durationS ?? 0;
    this.setState("loading");
    try {
      await this.ensureDevice();
    } catch (error) {
      const failure =
        error instanceof PlaybackError
          ? error
          : new PlaybackError("unknown", "Spotify player failed", { cause: error });
      // SDK errors were already reported by their listener.
      if (this.state !== "error") this.fail(failure);
      throw failure;
    }
    this.setState("paused");
    this.emitTime();
  }

  async play(): Promise<void> {
    if (!this.uri) return;
    // Spotify requires this to be invoked synchronously from the user's gesture.
    const activation = this.player?.activateElement?.();
    const { player, deviceId } = await this.ensureDevice();
    await activation?.catch(() => undefined);
    if (this.started) {
      await player.resume();
      return;
    }
    this.setState("loading");
    let response = await this.startOnDevice(deviceId);
    if (response.status === 404) {
      // The device went away (e.g. the tab slept): connect again and retry once.
      this.device = null;
      response = await this.startOnDevice((await this.ensureDevice()).deviceId);
    }
    if (response.ok) {
      this.started = true;
      return;
    }
    const error =
      response.status === 403
        ? new PlaybackError("account", "Spotify Premium is required to play here")
        : new PlaybackError("network", `Spotify refused to play (HTTP ${response.status})`);
    this.fail(error);
    throw error;
  }

  pause(): void {
    if (this.started) void this.player?.pause();
    else if (this.state !== "error") this.setState("paused");
  }

  seek(seconds: number): void {
    const max = this.duration > 0 ? this.duration : Infinity;
    this.time = Math.min(Math.max(0, seconds), max);
    if (this.started) void this.player?.seek(Math.round(this.time * 1000));
    else this.pendingPositionS = this.time;
    this.emitTime();
  }

  getTime(): number {
    return this.time;
  }

  getDuration(): number {
    return this.duration;
  }

  getState(): PlaybackState {
    return this.state;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    void this.player?.setVolume(volume);
  }

  on<E extends keyof PlaybackEvents>(
    event: E,
    listener: (payload: PlaybackEvents[E]) => void,
  ): () => void {
    return this.events.on(event, listener);
  }

  destroy(): void {
    this.stopPolling();
    this.player?.disconnect();
    this.player = null;
    this.device = null;
    this.events.clear();
  }

  // ── Internals ────────────────────────────────────────────────────────

  private startOnDevice(deviceId: string): Promise<Response> {
    return this.options.getToken().then((token) =>
      this.options.fetcher(`${API}/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          uris: [this.uri],
          position_ms: Math.round(this.pendingPositionS * 1000),
        }),
      }),
    );
  }

  private ensureDevice(): Promise<{ player: SpotifyPlayer; deviceId: string }> {
    this.device ??= this.options.loadSdk().then(
      (Spotify) =>
        new Promise((resolve, reject) => {
          const player = new Spotify.Player({
            name: "Purrlist",
            volume: this.volume,
            getOAuthToken: (cb) => {
              this.options
                .getToken()
                .then(cb, (error: unknown) =>
                  this.fail(
                    error instanceof PlaybackError
                      ? error
                      : new PlaybackError("account", "Spotify is not connected"),
                  ),
                );
            },
          });
          const timeout = setTimeout(
            () => reject(new PlaybackError("network", "The Spotify player did not get ready")),
            this.options.readyTimeoutMs,
          );
          const failWith = (code: "account" | "unsupported") => (e: { message: string }) => {
            clearTimeout(timeout);
            const error = new PlaybackError(code, e.message);
            reject(error);
            this.fail(error);
          };
          player.addListener("ready", ({ device_id }) => {
            clearTimeout(timeout);
            this.player = player;
            resolve({ player, deviceId: device_id });
          });
          player.addListener("not_ready", () => {
            this.device = null;
          });
          player.addListener("account_error", failWith("account"));
          player.addListener("authentication_error", failWith("account"));
          player.addListener("initialization_error", failWith("unsupported"));
          player.addListener("playback_error", (e) =>
            this.fail(new PlaybackError("unknown", e.message)),
          );
          player.addListener("player_state_changed", (state) => this.handleState(state));
          void player.connect();
        }),
    );
    this.device.catch(() => {
      this.device = null;
    });
    return this.device;
  }

  private handleState(state: SpotifyPlayerState | null): void {
    if (!state || !this.started) return;
    const uri = state.track_window.current_track?.uri;
    // Spotify's autoplay moved on to something we did not ask for: our track ended.
    if (uri && uri !== this.uri) {
      void this.player?.pause();
      return this.end();
    }
    if (state.duration > 0) this.duration = state.duration / 1000;
    const nearEnd = this.lastPositionMs >= state.duration - END_TOLERANCE_MS;
    if (state.paused && state.position === 0 && nearEnd && this.lastPositionMs > 0) {
      return this.end();
    }
    this.lastPositionMs = state.position;
    this.time = state.position / 1000;
    if (state.paused) {
      this.stopPolling();
      this.setState("paused");
    } else {
      this.setState("playing");
      this.startPolling();
    }
    this.emitTime();
  }

  private end(): void {
    this.stopPolling();
    this.started = false;
    this.lastPositionMs = 0;
    this.time = this.duration;
    this.setState("ended");
    this.events.emit("ended", undefined);
  }

  private fail(error: PlaybackError): void {
    this.stopPolling();
    this.setState("error");
    this.events.emit("error", error);
  }

  private startPolling(): void {
    if (this.poll) return;
    this.poll = setInterval(() => {
      void this.player?.getCurrentState().then((state) => {
        if (!state || state.paused || state.track_window.current_track?.uri !== this.uri) return;
        this.lastPositionMs = state.position;
        this.time = state.position / 1000;
        this.emitTime();
      });
    }, this.options.pollMs);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  private emitTime(): void {
    this.events.emit("time", { current: this.time, duration: this.duration });
  }

  private setState(state: PlaybackState): void {
    if (state === this.state) return;
    this.state = state;
    this.events.emit("state", state);
  }
}
