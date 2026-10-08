import { describe, expect, test } from "vitest";
import { MAX_RANK_LENGTH, rebalanceRanks } from "@/lib/ds/fractional-rank";
import type { LibraryTrack } from "@/lib/library/tracks";
import {
  applyPlaylistChange,
  applyPlaylistsChange,
  cleanTrackIds,
  MAX_TRACKS_PER_ADD,
  planMove,
  type RankedItem,
  ranksForAppend,
  validatePlaylistName,
} from "./playlists";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Applies rank updates and returns the track ids in rank (byte) order. */
function apply(items: RankedItem[], updates: { track_id: string; rank: string }[]): string[] {
  const ranks = new Map(items.map((item) => [item.track_id, item.rank]));
  for (const update of updates) ranks.set(update.track_id, update.rank);
  return [...ranks.entries()].sort(([, a], [, b]) => (a < b ? -1 : 1)).map(([trackId]) => trackId);
}

const items = (...ranks: string[]): RankedItem[] =>
  ranks.map((rank, i) => ({ track_id: `t${i}`, rank }));

describe("validatePlaylistName", () => {
  test("trims and collapses spaces, rejects empty or too long names", () => {
    expect(validatePlaylistName("  Para   estudiar ")).toBe("Para estudiar");
    expect(validatePlaylistName("   ")).toBeNull();
    expect(validatePlaylistName("x".repeat(101))).toBeNull();
  });
});

describe("cleanTrackIds", () => {
  test("keeps valid ids once, in order", () => {
    expect(cleanTrackIds([id(2), id(1), id(2)])).toEqual([id(2), id(1)]);
    expect(cleanTrackIds([])).toEqual([]);
  });

  test("rejects anything else", () => {
    expect(cleanTrackIds("x")).toBeNull();
    expect(cleanTrackIds([id(1), "nope"])).toBeNull();
    expect(
      cleanTrackIds(Array.from({ length: MAX_TRACKS_PER_ADD + 1 }, (_, i) => id(i))),
    ).toBeNull();
  });
});

describe("ranksForAppend", () => {
  test("an empty playlist gets short evenly spaced ranks", () => {
    expect(ranksForAppend(null, 3)).toEqual(rebalanceRanks(3));
  });

  test("goes after the last rank, in order", () => {
    const ranks = ranksForAppend("m", 5);
    expect(ranks).toHaveLength(5);
    expect(["m", ...ranks]).toEqual([...["m", ...ranks]].sort());
  });

  test("a broken last rank still yields valid ranks", () => {
    expect(ranksForAppend("BROKEN", 2)).toHaveLength(2);
  });
});

describe("planMove", () => {
  const list = items("a", "b", "c", "d");

  test("rewrites only the moved track", () => {
    const updates = planMove(list, "t3", "t0")!;
    expect(updates).toHaveLength(1);
    expect(apply(list, updates)).toEqual(["t0", "t3", "t1", "t2"]);
  });

  test("moves to the top and to the bottom", () => {
    expect(apply(list, planMove(list, "t2", null)!)).toEqual(["t2", "t0", "t1", "t3"]);
    expect(apply(list, planMove(list, "t0", "t3")!)).toEqual(["t1", "t2", "t3", "t0"]);
  });

  test("dropping in place changes nothing", () => {
    expect(planMove(list, "t1", "t0")).toEqual([]);
    expect(planMove(list, "t0", null)).toEqual([]);
  });

  test("unknown tracks or anchors are rejected", () => {
    expect(planMove(list, "missing", null)).toBeNull();
    expect(planMove(list, "t0", "missing")).toBeNull();
    expect(planMove(list, "t0", "t0")).toBeNull();
  });

  test("rebalances the whole playlist when ranks get too long", () => {
    const long = items("a", `a${"0".repeat(MAX_RANK_LENGTH)}1`, "b");
    const updates = planMove(long, "t2", "t0")!;
    expect(updates).toHaveLength(3);
    expect(apply(long, updates)).toEqual(["t0", "t2", "t1"]);
  });

  test("rebalances when stored ranks are broken", () => {
    const broken = items("b", "a", "c");
    const updates = planMove(broken, "t2", "t0")!;
    expect(updates).toHaveLength(3);
    expect(apply(broken, updates)).toEqual(["t0", "t2", "t1"]);
  });

  test("many moves in a row keep a consistent order", () => {
    let current = items(...rebalanceRanks(10));
    let order = current.map((item) => item.track_id);
    for (let i = 0; i < 100; i++) {
      const trackId = order[(i * 7) % order.length]!;
      const afterIndex = (i * 3) % order.length;
      const afterId = afterIndex === 0 ? null : order[afterIndex]!;
      const updates = planMove(current, trackId, afterId);
      if (!updates) continue;
      const ranks = new Map(current.map((item) => [item.track_id, item.rank]));
      for (const update of updates) ranks.set(update.track_id, update.rank);
      current = [...ranks.entries()]
        .map(([track_id, rank]) => ({ track_id, rank }))
        .sort((a, b) => (a.rank < b.rank ? -1 : 1));
      const expected = order.filter((t) => t !== trackId);
      expected.splice(afterId === null ? 0 : expected.indexOf(afterId) + 1, 0, trackId);
      order = current.map((item) => item.track_id);
      expect(order).toEqual(expected);
    }
  });
});

describe("optimistic changes", () => {
  const summaries = [
    { id: "a", name: "A", trackCount: 1, covers: [] },
    { id: "b", name: "B", trackCount: 0, covers: [] },
  ];

  test("playlist list: create (first), rename, delete", () => {
    const created = applyPlaylistsChange(summaries, {
      type: "create",
      playlist: { id: "c", name: "C", trackCount: 0, covers: [] },
    });
    expect(created.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(applyPlaylistsChange(summaries, { type: "rename", id: "b", name: "Bee" })[1]!.name).toBe(
      "Bee",
    );
    expect(applyPlaylistsChange(summaries, { type: "delete", id: "a" })).toEqual([summaries[1]]);
  });

  const track = (trackId: string) => ({ id: trackId, title: trackId }) as LibraryTrack;
  const detail = { id: "p", name: "P", tracks: ["x", "y", "z"].map(track) };
  const ids = (d: typeof detail) => d.tracks.map((t) => t.id);

  test("one playlist: rename, move and remove", () => {
    expect(applyPlaylistChange(detail, { type: "rename", name: "Q" }).name).toBe("Q");
    expect(ids(applyPlaylistChange(detail, { type: "move", trackId: "z", afterId: null }))).toEqual(
      ["z", "x", "y"],
    );
    expect(ids(applyPlaylistChange(detail, { type: "move", trackId: "x", afterId: "y" }))).toEqual([
      "y",
      "x",
      "z",
    ]);
    expect(ids(applyPlaylistChange(detail, { type: "remove", trackId: "y" }))).toEqual(["x", "z"]);
  });

  test("moves with unknown ids leave the playlist as it was", () => {
    expect(applyPlaylistChange(detail, { type: "move", trackId: "nope", afterId: null })).toBe(
      detail,
    );
    expect(applyPlaylistChange(detail, { type: "move", trackId: "x", afterId: "nope" })).toBe(
      detail,
    );
  });
});
