"use client";

import { useEffect } from "react";
import { type PlayEventInput, PlayTracker } from "@/lib/radio/play-tracker";
import { getPlayer } from "@/stores/player-store";

export const PLAY_EVENTS_URL = "/api/play-events";

function send(event: PlayEventInput | null): void {
  if (!event) return;
  // keepalive: the last play is still saved when the tab is closing.
  void fetch(PLAY_EVENTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {
    // Losing one play only makes stats and the radio a little less precise.
  });
}

/**
 * Records every play (time really listened, completed, skipped in < 30 s)
 * for the stats and the neko radio. Renders nothing.
 */
export function PlayEventLogger() {
  useEffect(() => {
    const engine = getPlayer();
    const tracker = new PlayTracker();
    tracker.update(engine.getSnapshot(), Date.now());
    const unsubscribe = engine.subscribe((snapshot) => send(tracker.update(snapshot, Date.now())));
    const onHide = () => send(tracker.flush());
    window.addEventListener("pagehide", onHide);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", onHide);
      send(tracker.flush());
    };
  }, []);

  return null;
}
