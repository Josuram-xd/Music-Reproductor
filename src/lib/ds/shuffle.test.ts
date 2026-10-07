import { describe, expect, test } from "vitest";
import {
  createRng,
  hashSeed,
  randomSeed,
  shuffle,
  shuffleInPlace,
  shuffleKeepingFirst,
} from "./shuffle";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe("createRng", () => {
  test("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(range(5).map(() => a())).toEqual(range(5).map(() => b()));
  });

  test("different seeds give different sequences", () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
    expect(createRng("queue-a")()).not.toBe(createRng("queue-b")());
  });

  test("accepts string seeds", () => {
    expect(createRng("nya")()).toBe(createRng("nya")());
    expect(createRng("nya")()).toBe(createRng(hashSeed("nya"))());
  });

  test("returns floats in [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("randomSeed", () => {
  test("returns an unsigned 32-bit integer", () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});

describe("shuffleInPlace", () => {
  test("mutates and returns the same array, keeping every item", () => {
    const items = range(20);
    const result = shuffleInPlace(items, createRng(1));
    expect(result).toBe(items);
    expect(sorted(result)).toEqual(range(20));
  });

  test("handles empty and single-item arrays", () => {
    expect(shuffleInPlace([], createRng(1))).toEqual([]);
    expect(shuffleInPlace(["a"], createRng(1))).toEqual(["a"]);
  });

  test("swaps with the index chosen by the rng (Fisher–Yates)", () => {
    // rng() = 0 always picks j = 0: [a,b,c] -> swap(2,0) -> [c,b,a] -> swap(1,0) -> [b,c,a]
    expect(shuffleInPlace(["a", "b", "c"], () => 0)).toEqual(["b", "c", "a"]);
    // rng() close to 1 always picks j = i: nothing moves
    expect(shuffleInPlace(["a", "b", "c"], () => 0.999)).toEqual(["a", "b", "c"]);
  });

  test("is roughly uniform over all permutations", () => {
    const rng = createRng("uniform");
    const counts = new Map<string, number>();
    const runs = 60_000;
    for (let i = 0; i < runs; i++) {
      const key = shuffleInPlace([1, 2, 3], rng).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(Math.abs(count - runs / 6)).toBeLessThan((runs / 6) * 0.05);
    }
  });
});

describe("shuffle", () => {
  test("returns a copy and leaves the input untouched", () => {
    const items = range(10);
    const result = shuffle(items, 3);
    expect(items).toEqual(range(10));
    expect(result).not.toBe(items);
    expect(sorted(result)).toEqual(range(10));
  });

  test("same seed, same order; different seed, different order", () => {
    const items = range(30);
    expect(shuffle(items, "abc")).toEqual(shuffle(items, "abc"));
    expect(shuffle(items, "abc")).not.toEqual(shuffle(items, "abd"));
  });
});

describe("shuffleKeepingFirst", () => {
  test("keeps the pinned item first and shuffles the rest", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const result = shuffleKeepingFirst(items, "d", 9);
    expect(result[0]).toBe("d");
    expect([...result].sort()).toEqual(items);
    expect(shuffleKeepingFirst(items, "d", 9)).toEqual(result);
  });

  test("falls back to a plain shuffle if the pinned item is missing", () => {
    const items = ["a", "b", "c", "d"];
    expect(shuffleKeepingFirst(items, "z", 5)).toEqual(shuffle(items, 5));
  });
});
