import { UUID } from "@/lib/library/folders";
import type { Track } from "@/lib/player/types";

/** What the radio learns from (rows of play_events / radio_feedback / search_history). */
export interface PlayEventRecord {
  track_id: string | null;
  source: string;
  external_id: string | null;
  artist: string | null;
  started_at: string;
  completed: boolean;
  skipped: boolean;
}

export interface FeedbackRecord {
  artist: string;
  /** Negative after "No me gusta". */
  score: number;
}

export interface Signals {
  /** Liking per artist key: completes (+), skips (−), fading with age. */
  artistAffinity: Map<string, number>;
  /** Same, only counting plays around this hour of the day. */
  hourAffinity: Map<string, number>;
  /** Liking per library folder. */
  folderAffinity: Map<string, number>;
  /** How many times each track was played. */
  playCount: Map<string, number>;
  /** Tracks played in the last 2 h: never recommended again so soon. */
  recent: Set<string>;
  /** "No me gusta" per artist key (negative). */
  feedback: Map<string, number>;
  /** Recent search words (lowercase). */
  searchTerms: string[];
  /** Best artists, display names, best first. */
  topArtists: string[];
}

export const RECENT_WINDOW_MS = 2 * 60 * 60 * 1000;
/** A play loses half its weight every this many days. */
const HALF_LIFE_DAYS = 30;
/** Plays within this many hours of the current hour count for the hour of day. */
const HOUR_WINDOW = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Artist names compared without case or extra spaces. */
export function artistKey(artist: string | null | undefined): string | null {
  const key = artist?.trim().replace(/\s+/g, " ").toLowerCase();
  return key ? key : null;
}

/** Same id for a play and a track: library uuid, or "source:externalId". */
export function trackKey(track: Pick<Track, "id" | "source" | "externalId">): string {
  if (UUID.test(track.id)) return track.id;
  return `${track.source}:${track.externalId ?? track.id}`;
}

function eventKey(event: PlayEventRecord): string {
  return event.track_id ?? `${event.source}:${event.external_id ?? ""}`;
}

const add = (map: Map<string, number>, key: string, value: number) =>
  map.set(key, (map.get(key) ?? 0) + value);

/** Circular distance between two hours of the day (23 and 1 are 2 apart). */
function hourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

/**
 * Turns the raw history into the numbers the scorer uses. `folderOf` maps a
 * library track id to its folder (folders the user listens to count too).
 */
export function buildSignals({
  events,
  feedback,
  searches,
  folderOf = () => null,
  now,
}: {
  events: readonly PlayEventRecord[];
  feedback: readonly FeedbackRecord[];
  searches: readonly string[];
  folderOf?: (trackId: string) => string | null;
  now: number;
}): Signals {
  const signals: Signals = {
    artistAffinity: new Map(),
    hourAffinity: new Map(),
    folderAffinity: new Map(),
    playCount: new Map(),
    recent: new Set(),
    feedback: new Map(),
    searchTerms: [],
    topArtists: [],
  };
  const names = new Map<string, string>();
  const currentHour = new Date(now).getHours();

  for (const event of events) {
    const started = Date.parse(event.started_at);
    if (!Number.isFinite(started)) continue;
    const key = eventKey(event);
    add(signals.playCount, key, 1);
    if (now - started < RECENT_WINDOW_MS) signals.recent.add(key);

    const weight =
      (event.completed ? 1 : event.skipped ? -1 : 0.3) *
      0.5 ** (Math.max(0, now - started) / DAY_MS / HALF_LIFE_DAYS);
    const artist = artistKey(event.artist);
    if (artist) {
      names.set(artist, names.get(artist) ?? event.artist!.trim());
      add(signals.artistAffinity, artist, weight);
      if (hourDistance(new Date(started).getHours(), currentHour) <= HOUR_WINDOW) {
        add(signals.hourAffinity, artist, weight);
      }
    }
    const folder = event.track_id ? folderOf(event.track_id) : null;
    if (folder) add(signals.folderAffinity, folder, weight);
  }

  for (const { artist, score } of feedback) {
    const key = artistKey(artist);
    if (key) signals.feedback.set(key, score);
  }

  signals.searchTerms = [
    ...new Set(
      searches.flatMap((query) =>
        query
          .toLowerCase()
          .split(/\s+/)
          .filter((word) => word.length >= 3),
      ),
    ),
  ];

  signals.topArtists = [...signals.artistAffinity.entries()]
    .map(([key, value]) => [key, value + (signals.feedback.get(key) ?? 0) * 2] as const)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => names.get(key) ?? key);

  return signals;
}
