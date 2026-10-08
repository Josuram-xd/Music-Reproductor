import { describe, expect, test } from "vitest";
import {
  isValidRank,
  MAX_RANK_LENGTH,
  rankBetween,
  ranksBetween,
  rebalanceRanks,
} from "./fractional-rank";

/** Byte order, like `collate "C"` in Postgres. */
const sorted = (ranks: string[]) => [...ranks].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const expectIncreasing = (ranks: string[]) => {
  for (let i = 1; i < ranks.length; i++) expect(ranks[i - 1]! < ranks[i]!).toBe(true);
  for (const rank of ranks) expect(isValidRank(rank)).toBe(true);
};

describe("rankBetween", () => {
  test("the first key of an empty list is the middle", () => {
    expect(rankBetween(null, null)).toBe("i");
  });

  test("goes before, after and between keys", () => {
    expect(rankBetween(null, "i") < "i").toBe(true);
    expect(rankBetween("i", null) > "i").toBe(true);
    const mid = rankBetween("a", "c");
    expect(mid).toBe("b");
  });

  test("finds room between consecutive keys", () => {
    const mid = rankBetween("a", "b");
    expectIncreasing(["a", mid, "b"]);
    const deeper = rankBetween("a", mid);
    expectIncreasing(["a", deeper, mid]);
  });

  test("handles keys of different lengths", () => {
    for (const [a, b] of [
      ["a", "a1"],
      ["az", "b"],
      ["a5", "a51"],
      ["1", "11"],
    ] as const) {
      expectIncreasing([a, rankBetween(a, b), b]);
    }
  });

  test("never produces a trailing zero", () => {
    expect(rankBetween(null, "1")).not.toMatch(/0$/);
    expect(rankBetween("z", null)).not.toMatch(/0$/);
  });

  test("rejects invalid or unordered keys", () => {
    expect(() => rankBetween("b", "a")).toThrow(/out of order/);
    expect(() => rankBetween("a", "a")).toThrow(/out of order/);
    expect(() => rankBetween("a0", null)).toThrow(/Invalid/);
    expect(() => rankBetween("A", null)).toThrow(/Invalid/);
    expect(() => rankBetween("", null)).toThrow(/Invalid/);
  });

  test("repeated inserts at the front, the end and the same gap stay ordered", () => {
    const ranks = [rankBetween(null, null)];
    for (let i = 0; i < 200; i++) ranks.unshift(rankBetween(null, ranks[0]!));
    for (let i = 0; i < 200; i++) ranks.push(rankBetween(ranks.at(-1)!, null));
    let low = ranks[100]!;
    const high = ranks[101]!;
    for (let i = 0; i < 50; i++) {
      low = rankBetween(low, high);
      ranks.splice(101, 0, low);
      ranks.sort();
    }
    expectIncreasing(sorted(ranks));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  test("random moves keep a consistent order (simulated list)", () => {
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const list = ranksBetween(null, null, 20);
    for (let step = 0; step < 500; step++) {
      const from = Math.floor(random() * list.length);
      list.splice(from, 1);
      const to = Math.floor(random() * (list.length + 1));
      list.splice(to, 0, rankBetween(list[to - 1] ?? null, list[to] ?? null));
      expectIncreasing(list);
    }
  });
});

describe("ranksBetween", () => {
  test("returns count increasing keys inside the gap", () => {
    expect(ranksBetween(null, null, 0)).toEqual([]);
    const ranks = ranksBetween("a", "b", 50);
    expect(ranks).toHaveLength(50);
    expectIncreasing(["a", ...ranks, "b"]);
  });

  test("keys grow logarithmically", () => {
    const ranks = ranksBetween(null, null, 1000);
    expectIncreasing(ranks);
    expect(Math.max(...ranks.map((r) => r.length))).toBeLessThanOrEqual(12);
  });

  test("rejects invalid counts", () => {
    expect(() => ranksBetween(null, null, -1)).toThrow(RangeError);
    expect(() => ranksBetween(null, null, 1.5)).toThrow(RangeError);
  });
});

describe("rebalanceRanks", () => {
  test.each([0, 1, 2, 35, 36, 100, 5000])("%i short, evenly spaced keys", (count) => {
    const ranks = rebalanceRanks(count);
    expect(ranks).toHaveLength(count);
    expectIncreasing(ranks);
    expect(new Set(ranks).size).toBe(count);
    for (const rank of ranks) expect(rank.length).toBeLessThan(MAX_RANK_LENGTH);
  });

  test("leaves room to insert between neighbours", () => {
    const [a, b] = rebalanceRanks(2);
    expectIncreasing([a!, rankBetween(a!, b!), b!]);
  });
});
