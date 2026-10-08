"use client";

import { useEffect } from "react";
import { bindMediaSession, syncMediaSession } from "@/lib/player/media-session";
import { queueShortcutFor, shortcutFor } from "@/lib/player/shortcuts";
import { player, runPlayerAction, usePlayerStore } from "@/stores/player-store";
import { queue } from "@/stores/queue-store";

/**
 * Wires the player (and queue undo/redo) to the keyboard and to the system
 * media controls. Renders nothing.
 */
export function PlayerHost() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const queueAction = queueShortcutFor(event);
      if (queueAction) {
        event.preventDefault();
        return queueAction === "undo" ? queue.undo() : queue.redo();
      }
      const action = shortcutFor(event);
      if (!action) return;
      event.preventDefault(); // e.g. Space would scroll the page
      // Holding an arrow keeps seeking; holding Space must not flip play/pause.
      if (event.repeat && action !== "seekBackward" && action !== "seekForward") return;
      runPlayerAction(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const unbind = bindMediaSession(session, {
      play: player.play,
      pause: player.pause,
      previous: () => void player.back(),
      next: player.next,
      seekBy: player.seekBy,
      seekTo: player.seek,
    });
    syncMediaSession(session, usePlayerStore.getState());
    const unsubscribe = usePlayerStore.subscribe((snapshot) => syncMediaSession(session, snapshot));
    return () => {
      unsubscribe();
      unbind();
    };
  }, []);

  return null;
}
