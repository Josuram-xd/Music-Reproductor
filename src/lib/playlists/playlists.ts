import {
  isValidRank,
  MAX_RANK_LENGTH,
  rankBetween,
  ranksBetween,
  rebalanceRanks,
} from "@/lib/ds/fractional-rank";
import { UUID, validateFolderName } from "@/lib/library/folders";
import type { LibraryTrack } from "@/lib/library/tracks";

/** Same rules as folder names: 1–100 characters, spaces collapsed. */
export const validatePlaylistName = validateFolderName;
export const MAX_PLAYLIST_NAME = 100;

/** Most tracks added in one go (e.g. saving a long queue). */
export const MAX_TRACKS_PER_ADD = 2000;

/** The minimum to list a playlist (sidebar, "Añadir a…"). */
export interface PlaylistName {
  id: string;
  name: string;
}

/** A playlist card on the playlists page. */
export interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  /** Signed cover URLs of the first tracks, for the mosaic (up to 4). */
  covers: string[];
}

/** One playlist with its tracks in order. */
export interface PlaylistDetail {
  id: string;
  name: string;
  tracks: LibraryTrack[];
}

export const isId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

/** Valid, de-duplicated track ids (keeps the first occurrence), or `null`. */
export function cleanTrackIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_TRACKS_PER_ADD || !value.every(isId)) {
    return null;
  }
  return [...new Set(value)];
}

// ── Ranks ──────────────────────────────────────────────────────────────────

export interface RankedItem {
  track_id: string;
  rank: string;
}

/** New rank for each track, keyed by track id. */
export type RankUpdate = { track_id: string; rank: string }[];

/** Ranks for `count` tracks appended after `lastRank` (`null` = empty playlist). */
export function ranksForAppend(lastRank: string | null, count: number): string[] {
  if (lastRank === null) return rebalanceRanks(count);
  return ranksBetween(isValidRank(lastRank) ? lastRank : null, null, count);
}

/**
 * Rank changes to move `trackId` right after `afterId` (`null` = to the top),
 * given the items in rank order. Usually one row; if keys got too long (or
 * are broken) the whole playlist is rebalanced. Empty if nothing changes.
 */
export function planMove(
  items: readonly RankedItem[],
  trackId: string,
  afterId: string | null,
): RankUpdate | null {
  const from = items.findIndex((item) => item.track_id === trackId);
  if (from < 0 || trackId === afterId) return null;
  const rest = items.filter((item) => item.track_id !== trackId);
  const to = afterId === null ? 0 : rest.findIndex((item) => item.track_id === afterId) + 1;
  if (afterId !== null && to === 0) return null;
  if (to === from) return [];

  const before = rest[to - 1]?.rank ?? null;
  const after = rest[to]?.rank ?? null;
  try {
    const rank = rankBetween(before, after);
    if (rank.length <= MAX_RANK_LENGTH) return [{ track_id: trackId, rank }];
  } catch {
    // Broken neighbours (out of order or invalid): rebalance below.
  }
  const order = [...rest.slice(0, to), items[from]!, ...rest.slice(to)];
  const ranks = rebalanceRanks(order.length);
  return order.map((item, i) => ({ track_id: item.track_id, rank: ranks[i]! }));
}

// ── Optimistic changes (the UI updates before the server answers) ─────────

export type PlaylistsChange =
  | { type: "create"; playlist: PlaylistSummary }
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string };

export function applyPlaylistsChange(
  playlists: PlaylistSummary[],
  change: PlaylistsChange,
): PlaylistSummary[] {
  switch (change.type) {
    case "create":
      return [change.playlist, ...playlists];
    case "rename":
      return playlists.map((p) => (p.id === change.id ? { ...p, name: change.name } : p));
    case "delete":
      return playlists.filter((p) => p.id !== change.id);
  }
}

export type PlaylistChange =
  | { type: "rename"; name: string }
  | { type: "move"; trackId: string; afterId: string | null }
  | { type: "remove"; trackId: string };

export function applyPlaylistChange(
  playlist: PlaylistDetail,
  change: PlaylistChange,
): PlaylistDetail {
  switch (change.type) {
    case "rename":
      return { ...playlist, name: change.name };
    case "remove":
      return { ...playlist, tracks: playlist.tracks.filter((t) => t.id !== change.trackId) };
    case "move": {
      const moving = playlist.tracks.find((t) => t.id === change.trackId);
      if (!moving) return playlist;
      const rest = playlist.tracks.filter((t) => t.id !== change.trackId);
      const to = change.afterId === null ? 0 : rest.findIndex((t) => t.id === change.afterId) + 1;
      if (change.afterId !== null && to === 0) return playlist;
      return { ...playlist, tracks: [...rest.slice(0, to), moving, ...rest.slice(to)] };
    }
  }
}
