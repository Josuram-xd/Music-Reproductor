import { describe, expect, test, vi } from "vitest";
import type { LibraryTrack } from "@/lib/library/tracks";
import type { Track } from "@/lib/player/types";
import { generateCandidates } from "./candidates";
import { type Candidate, pickRecommendations, scoreCandidate } from "./score";
import {
  artistKey,
  buildSignals,
  type PlayEventRecord,
  RECENT_WINDOW_MS,
  trackKey,
} from "./signals";

const NOW = Date.parse("2026-10-07T20:00:00");
const DAY = 24 * 60 * 60 * 1000;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const event = (overrides: Partial<PlayEventRecord> & { ago: number }): PlayEventRecord => ({
  track_id: id(1),
  source: "audio",
  external_id: null,
  artist: "Mochi",
  completed: false,
  skipped: false,
  ...overrides,
  started_at: new Date(NOW - overrides.ago).toISOString(),
});

const track = (n: number, artist: string, extra: Partial<Track> = {}): Track => ({
  id: id(n),
  source: "audio",
  title: `Song ${n}`,
  artist,
  ...extra,
});
const lib = (n: number, artist: string): Candidate => ({
  track: track(n, artist),
  origin: "library",
});

describe("signals", () => {
  test("artist keys ignore case and spaces; track keys match plays and tracks", () => {
    expect(artistKey("  Neko   Band ")).toBe("neko band");
    expect(artistKey("  ")).toBeNull();
    expect(trackKey(track(1, "x"))).toBe(id(1));
    expect(trackKey({ id: "yt:abc", source: "youtube", externalId: "abc" })).toBe("youtube:abc");
  });

  test("completes add, skips subtract, old plays weigh less", () => {
    const signals = buildSignals({
      events: [
        event({ ago: DAY, artist: "Mochi", completed: true }),
        event({ ago: DAY, artist: "Mochi", completed: true }),
        event({ ago: DAY, artist: "Tama", skipped: true }),
        event({ ago: 120 * DAY, artist: "Old", completed: true }),
      ],
      feedback: [],
      searches: [],
      now: NOW,
    });
    expect(signals.artistAffinity.get("mochi")).toBeGreaterThan(1.9);
    expect(signals.artistAffinity.get("tama")).toBeLessThan(0);
    expect(signals.artistAffinity.get("old")).toBeLessThan(0.1);
    expect(signals.topArtists).toEqual(["Mochi", "Old"]);
  });

  test("the last 2 h are 'recent'; folders and hours of the day count", () => {
    const signals = buildSignals({
      events: [
        event({ ago: RECENT_WINDOW_MS - 1000, track_id: id(5), completed: true }),
        event({ ago: 3 * DAY, track_id: id(6), artist: "Night", completed: true }),
      ],
      feedback: [],
      searches: [],
      folderOf: (trackId) => (trackId === id(5) ? "f1" : null),
      now: NOW,
    });
    expect(signals.recent).toEqual(new Set([id(5)]));
    expect(signals.folderAffinity.get("f1")).toBeGreaterThan(0);
    // Same hour (20:00), three days ago.
    expect(signals.hourAffinity.get("night")).toBeGreaterThan(0);
  });

  test("feedback and searches", () => {
    const signals = buildSignals({
      events: [event({ ago: DAY, artist: "Tama", completed: true })],
      feedback: [{ artist: " TAMA ", score: -1 }],
      searches: ["lofi chill beats", "a b"],
      now: NOW,
    });
    expect(signals.feedback.get("tama")).toBe(-1);
    expect(signals.topArtists).toEqual([]); // 1 − 2 < 0
    expect(signals.searchTerms).toEqual(["lofi", "chill", "beats"]);
  });
});

describe("scoring and picking (Max-Heap)", () => {
  const signals = buildSignals({
    events: [
      event({ ago: DAY, artist: "Mochi", completed: true, track_id: id(1) }),
      event({ ago: DAY, artist: "Mochi", completed: true, track_id: id(1) }),
      event({ ago: DAY, artist: "Tama", skipped: true, track_id: id(2) }),
      event({ ago: 60_000, artist: "Mochi", completed: true, track_id: id(3) }),
    ],
    feedback: [{ artist: "Grumpy", score: -3 }],
    searches: ["lofi"],
    now: NOW,
  });

  test("liked artists, little-played tracks and the library score higher", () => {
    const liked = scoreCandidate(lib(10, "Mochi"), signals);
    const skipped = scoreCandidate(lib(11, "Tama"), signals);
    const played = scoreCandidate(lib(1, "Mochi"), signals);
    const fromYouTube = scoreCandidate({ ...lib(12, "Mochi"), origin: "youtube" }, signals);
    expect(liked).toBeGreaterThan(skipped);
    expect(liked).toBeGreaterThan(played);
    expect(liked).toBeGreaterThan(fromYouTube);
  });

  test("a recent search boosts matching tracks", () => {
    const plain = scoreCandidate(lib(20, "Nobody"), signals);
    const matching = scoreCandidate(
      { ...lib(21, "Nobody"), track: track(21, "Nobody", { title: "Lofi nap" }) },
      signals,
    );
    expect(matching).toBeGreaterThan(plain);
  });

  test("picks the best, marked as radio, without recent, queued, disliked or repeated", () => {
    const picks = pickRecommendations(
      [
        lib(3, "Mochi"), // played a minute ago
        lib(10, "Mochi"),
        lib(10, "Mochi"), // duplicate
        lib(13, "Mochi"),
        lib(14, "Mochi"), // third Mochi: over maxPerArtist
        lib(15, "Grumpy"), // disliked
        lib(16, "Tama"),
        lib(17, "Queued"),
      ],
      signals,
      { count: 5, exclude: new Set([id(17)]), maxPerArtist: 2 },
    );
    expect(picks.map((t) => t.id)).toEqual([id(10), id(13), id(16)]);
    expect(picks.every((t) => t.radio)).toBe(true);
  });

  test("respects the count", () => {
    const many = Array.from({ length: 20 }, (_, i) => lib(100 + i, `Artist ${i}`));
    expect(pickRecommendations(many, signals, { count: 5 })).toHaveLength(5);
  });
});

describe("generateCandidates", () => {
  const row = (n: number, artist: string, folder: string | null = null) =>
    ({
      id: id(n),
      folder_id: folder,
      source: "audio",
      origin: "file",
      title: `Song ${n}`,
      artist,
      duration_s: 100,
      storage_path: `u/${n}.mp3`,
      external_id: null,
      mime: "audio/mpeg",
      size_bytes: 1,
      cover_path: null,
      created_at: "2026-01-01T00:00:00Z",
    }) as LibraryTrack;

  test("without history: the whole library, nothing searched", async () => {
    const signals = buildSignals({ events: [], feedback: [], searches: [], now: NOW });
    const searchYouTube = vi.fn();
    const candidates = await generateCandidates(
      { library: [row(1, "A"), row(2, "B")], searchYouTube },
      signals,
    );
    expect(candidates.map((c) => c.track.id)).toEqual([id(1), id(2)]);
    expect(searchYouTube).not.toHaveBeenCalled();
  });

  test("library of top artists/folders first, then YouTube and Spotify by top artist", async () => {
    const signals = buildSignals({
      events: [
        event({ ago: DAY, artist: "Mochi", completed: true, track_id: id(1) }),
        event({ ago: DAY, artist: "Other", completed: true, track_id: id(9) }),
      ],
      feedback: [],
      searches: [],
      folderOf: (trackId) => (trackId === id(9) ? "fav" : null),
      now: NOW,
    });
    const searchYouTube = vi.fn(async (q: string) => [
      { videoId: `v-${q}`, title: q, channel: q, durationS: 60, thumbnail: "" },
    ]);
    const searchSpotify = vi.fn().mockRejectedValue(new Error("rate limited"));
    const candidates = await generateCandidates(
      {
        library: [row(2, "Mochi"), row(3, "Stranger"), row(4, "Stranger", "fav")],
        searchYouTube,
        searchSpotify,
      },
      signals,
    );
    expect(candidates.map((c) => [c.origin, c.track.id])).toEqual([
      ["library", id(2)],
      ["library", id(4)],
      ["youtube", "yt:v-Mochi"],
      ["youtube", "yt:v-Other"],
    ]);
    expect(searchSpotify).toHaveBeenCalledWith('artist:"Mochi"');
  });
});
