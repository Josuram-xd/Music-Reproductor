import type { PlayerSnapshot } from "./player-engine";

export interface MediaSessionHandlers {
  play: () => void;
  pause: () => void;
  previous: () => void;
  next: () => void;
  seekBy: (deltaSeconds: number) => void;
  seekTo: (seconds: number) => void;
}

const DEFAULT_SKIP_S = 10;

/**
 * Lock screen / system media controls (Media Session API). Returns a cleanup
 * that removes the handlers. Actions the browser does not support are skipped.
 */
export function bindMediaSession(session: MediaSession, handlers: MediaSessionHandlers) {
  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => handlers.play()],
    ["pause", () => handlers.pause()],
    ["previoustrack", () => handlers.previous()],
    ["nexttrack", () => handlers.next()],
    ["seekbackward", (details) => handlers.seekBy(-(details.seekOffset ?? DEFAULT_SKIP_S))],
    ["seekforward", (details) => handlers.seekBy(details.seekOffset ?? DEFAULT_SKIP_S)],
    [
      "seekto",
      (details) => {
        if (details.seekTime !== undefined) handlers.seekTo(details.seekTime);
      },
    ],
  ];
  const bound: MediaSessionAction[] = [];
  for (const [action, handler] of actions) {
    try {
      session.setActionHandler(action, handler);
      bound.push(action);
    } catch {
      // Unsupported action in this browser.
    }
  }
  return () => {
    for (const action of bound) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // ignore
      }
    }
  };
}

/** Mirrors the player state (title, artist, play state, position) to the system. */
export function syncMediaSession(session: MediaSession, snapshot: PlayerSnapshot): void {
  const { current, state, time, duration } = snapshot;
  if (!current) {
    session.metadata = null;
    session.playbackState = "none";
    return;
  }
  // Only rebuild metadata when the track changes (it is not free on mobile).
  const metadata = session.metadata;
  if (!metadata || metadata.title !== current.title || metadata.artist !== (current.artist ?? "")) {
    session.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist ?? "",
      album: "Purrlist",
    });
  }
  session.playbackState = state === "playing" || state === "loading" ? "playing" : "paused";
  if (duration > 0 && typeof session.setPositionState === "function") {
    try {
      session.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, time), duration),
      });
    } catch {
      // Some browsers throw on transient invalid states; it is only cosmetic.
    }
  }
}
