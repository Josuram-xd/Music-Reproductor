import { create } from "zustand";
import { LocalAudioSource } from "@/lib/player/local-audio-source";
import { signedMediaUrl } from "@/lib/player/media-url";
import { FIRST_TRACK_MESSAGE, playbackErrorMessage, REPEAT_LABELS } from "@/lib/player/messages";
import { PlayerEngine, type PlayerSnapshot, SEEK_STEP_S } from "@/lib/player/player-engine";
import { SpotifySource } from "@/lib/player/spotify-source";
import { getYouTubeHost } from "@/lib/player/youtube-host";
import { YouTubeSource } from "@/lib/player/youtube-source";
import type { PlayerAction } from "@/lib/player/shortcuts";
import { spotifyAccessToken } from "@/lib/spotify/client-token";
import { toast } from "./toast-store";

const EMPTY: PlayerSnapshot = {
  current: null,
  queue: [],
  state: "idle",
  time: 0,
  duration: 0,
  volume: 1,
  muted: false,
  repeat: "off",
  hasPrevious: false,
  hasNext: false,
};

/** Read-only player state for components; mutate through `player` below. */
export const usePlayerStore = create<PlayerSnapshot>()(() => EMPTY);

let engine: PlayerEngine | null = null;

/** The app-wide engine, created on first use in the browser (it needs `Audio` and the DOM). */
export function getPlayer(): PlayerEngine {
  if (!engine) {
    engine = new PlayerEngine({
      sources: [
        new LocalAudioSource({ resolveUrl: signedMediaUrl }),
        // The IFrame API script only loads with the first YouTube track.
        new YouTubeSource({ getHost: getYouTubeHost }),
        // The Web Playback SDK only loads with the first Spotify track.
        new SpotifySource({ getToken: () => spotifyAccessToken() }),
      ],
    });
    engine.subscribe((snapshot) => usePlayerStore.setState(snapshot, true));
    engine.onError((error) => toast(playbackErrorMessage(error), { tone: "error" }));
  }
  return engine;
}

/** UI actions shared by the player bar, keyboard shortcuts and media keys. */
export const player = {
  toggle: () => void getPlayer().toggle(),
  play: () => void getPlayer().play(),
  pause: () => getPlayer().pause(),
  next: () => void getPlayer().next(),
  async back() {
    if ((await getPlayer().back()) === "first") toast(FIRST_TRACK_MESSAGE, { tone: "warn" });
  },
  seek: (seconds: number) => getPlayer().seek(seconds),
  seekBy: (delta: number) => getPlayer().seekBy(delta),
  setVolume: (volume: number) => getPlayer().setVolume(volume),
  toggleMute: () => getPlayer().toggleMute(),
  cycleRepeat() {
    toast(REPEAT_LABELS[getPlayer().cycleRepeat()], { durationMs: 2000 });
  },
};

/** Runs a keyboard shortcut action. */
export function runPlayerAction(action: PlayerAction): void {
  switch (action) {
    case "toggle":
      return player.toggle();
    case "seekBackward":
      return player.seekBy(-SEEK_STEP_S);
    case "seekForward":
      return player.seekBy(SEEK_STEP_S);
    case "previous":
      return void player.back();
    case "next":
      return player.next();
    case "toggleMute":
      return player.toggleMute();
    case "cycleRepeat":
      return player.cycleRepeat();
  }
}
