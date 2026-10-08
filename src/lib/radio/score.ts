import { PriorityQueue } from "@/lib/ds/priority-queue";
import type { Track } from "@/lib/player/types";
import { artistKey, type Signals, trackKey } from "./signals";

export type CandidateOrigin = "library" | "youtube" | "spotify";

/** A track the radio could add, and where it came from. */
export interface Candidate {
  track: Track;
  origin: CandidateOrigin;
  /** Library folder, for folder affinity. */
  folderId?: string | null;
}

export interface Scored {
  candidate: Candidate;
  key: string;
  score: number;
}

/** Your own library first: it costs nothing and you already chose it. */
const ORIGIN_BONUS: Record<CandidateOrigin, number> = { library: 1, youtube: 0.6, spotify: 0.6 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * How much the user would like `candidate` now: artist affinity, the
 * same at this hour of the day, folder affinity, little-played tracks,
 * recent searches, minus "No me gusta".
 */
export function scoreCandidate(candidate: Candidate, signals: Signals): number {
  const { track } = candidate;
  const artist = artistKey(track.artist);
  const plays = signals.playCount.get(trackKey(track)) ?? 0;
  const text = `${track.title} ${track.artist ?? ""}`.toLowerCase();

  let score = ORIGIN_BONUS[candidate.origin];
  if (artist) {
    score += clamp(signals.artistAffinity.get(artist) ?? 0, -3, 5);
    score += 0.5 * clamp(signals.hourAffinity.get(artist) ?? 0, -2, 3);
    score += 2 * (signals.feedback.get(artist) ?? 0);
  }
  if (candidate.folderId) {
    score += 0.5 * clamp(signals.folderAffinity.get(candidate.folderId) ?? 0, -2, 3);
  }
  score += 1 / (1 + plays);
  if (signals.searchTerms.some((term) => text.includes(term))) score += 0.8;
  return Math.round(score * 1000) / 1000;
}

/**
 * Picks the best `count` candidates with a Max-Heap, skipping what played
 * in the last 2 h, what is already queued (`exclude`), duplicates, disliked
 * artists, and more than `maxPerArtist` songs of one artist.
 */
export function pickRecommendations(
  candidates: readonly Candidate[],
  signals: Signals,
  { count = 5, exclude = new Set<string>(), maxPerArtist = 2 } = {},
): Track[] {
  const heap = new PriorityQueue<Scored>(
    // Higher score first; ties broken by key so results are stable.
    (a, b) => a.score - b.score || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0),
  );
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = trackKey(candidate.track);
    if (seen.has(key) || exclude.has(key) || signals.recent.has(key)) continue;
    seen.add(key);
    const artist = artistKey(candidate.track.artist);
    if (artist && (signals.feedback.get(artist) ?? 0) <= -3) continue;
    heap.push({ candidate, key, score: scoreCandidate(candidate, signals) });
  }

  const picked: Track[] = [];
  const perArtist = new Map<string, number>();
  while (picked.length < count && !heap.isEmpty) {
    const { candidate } = heap.pop()!;
    const artist = artistKey(candidate.track.artist) ?? "";
    if (artist && (perArtist.get(artist) ?? 0) >= maxPerArtist) continue;
    perArtist.set(artist, (perArtist.get(artist) ?? 0) + 1);
    picked.push({ ...candidate.track, radio: true });
  }
  return picked;
}
