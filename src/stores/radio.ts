import { RADIO_MESSAGES } from "@/lib/player/messages";
import type { Track } from "@/lib/player/types";
import { artistKey, trackKey } from "@/lib/radio/signals";
import { getPlayer } from "./player-store";
import { queue } from "./queue-store";
import { settings, useSettingsStore } from "./settings-store";
import { toast } from "./toast-store";

export const RECOMMENDATIONS_URL = "/api/radio/recommendations";
export const FEEDBACK_URL = "/api/radio/feedback";

/** Neko radio actions (refill, "No me gusta", on/off). */
export const radio = {
  /** Asks the server for picks that are not queued yet and appends them. Returns how many. */
  async refill(count: number): Promise<number> {
    const exclude = getPlayer().getSnapshot().queue.map(trackKey);
    const response = await fetch(RECOMMENDATIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, exclude }),
    });
    if (!response.ok) throw new Error(`Radio refill failed: ${response.status}`);
    const { tracks } = (await response.json()) as { tracks?: Track[] };
    const picks = (tracks ?? []).map((track) => ({ ...track, radio: true }));
    const added = picks.length > 0 ? queue.addMany(picks) : 0;
    if (added > 0) toast(RADIO_MESSAGES.added(added), { durationMs: 2500 });
    return added;
  },

  /**
   * "No me gusta": penalizes the artist and takes their recommendations
   * out of the queue (the one playing stays).
   */
  async dislike(track: Track): Promise<void> {
    const key = artistKey(track.artist);
    const sameArtist = getPlayer()
      .getSnapshot()
      .queue.filter((t) => t.radio && (t.id === track.id || (key && artistKey(t.artist) === key)))
      .map((t) => t.id);
    queue.remove(sameArtist);
    if (!key) return;
    const response = await fetch(FEEDBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist: track.artist }),
    }).catch(() => null);
    if (response?.ok) toast(RADIO_MESSAGES.disliked(track.artist!.trim()), { durationMs: 2500 });
    else toast(RADIO_MESSAGES.dislikeFailed, { tone: "error" });
  },

  async toggle(): Promise<void> {
    const enabled = !useSettingsStore.getState().radioEnabled;
    if (await settings.update({ radioEnabled: enabled })) {
      toast(enabled ? RADIO_MESSAGES.on : RADIO_MESSAGES.off, { durationMs: 2500 });
    }
  },
};
