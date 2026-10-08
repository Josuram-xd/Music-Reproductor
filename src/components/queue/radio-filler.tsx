"use client";

import { useEffect } from "react";
import { upNextOf } from "@/components/queue/queue-board";
import { nextAttemptAt, REFILL_COUNT, shouldRefill } from "@/lib/radio/refill";
import { usePlayerStore } from "@/stores/player-store";
import { radio } from "@/stores/radio";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Neko radio: when ≤ 1 track is left after the current one (and the radio
 * is on), adds recommendations marked 🐾. Renders nothing.
 */
export function RadioFiller() {
  useEffect(() => {
    let inFlight = false;
    let notBefore = 0;

    const check = () => {
      const player = usePlayerStore.getState();
      const { loaded, radioEnabled } = useSettingsStore.getState();
      const state = {
        enabled: loaded && radioEnabled,
        hasCurrent: player.current !== null,
        upNextCount: upNextOf(player.queue, player.current?.id).length,
        inFlight,
        notBefore,
        now: Date.now(),
      };
      if (!shouldRefill(state)) return;
      inFlight = true;
      radio
        .refill(REFILL_COUNT)
        .then(
          (added) => (notBefore = nextAttemptAt(Date.now(), added)),
          () => (notBefore = nextAttemptAt(Date.now(), null)),
        )
        .finally(() => {
          inFlight = false;
        });
    };

    check();
    const offPlayer = usePlayerStore.subscribe(check);
    const offSettings = useSettingsStore.subscribe(check);
    return () => {
      offPlayer();
      offSettings();
    };
  }, []);

  return null;
}
