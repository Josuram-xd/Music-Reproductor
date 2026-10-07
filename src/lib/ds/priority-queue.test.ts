import { describe, expect, test } from "vitest";
import { createRng } from "./shuffle";
import { byScore, PriorityQueue, topN } from "./priority-queue";

const numbers = (items: number[] = []) => new PriorityQueue<number>((a, b) => a - b, items);

/** Pops everything, highest priority first. */
const drain = <T>(queue: PriorityQueue<T>) => queue.take(Infinity);

describe("PriorityQueue", () => {
  test("starts empty", () => {
    const queue = numbers();
    expect(queue.size).toBe(0);
    expect(queue.isEmpty).toBe(true);
    expect(queue.peek()).toBeUndefined();
    expect(queue.pop()).toBeUndefined();
  });

  test("push and pop return the highest priority first", () => {
    const queue = numbers();
    for (const n of [5, 1, 9, 3, 7]) queue.push(n);
    expect(queue.peek()).toBe(9);
    expect(queue.size).toBe(5);
    expect(drain(queue)).toEqual([9, 7, 5, 3, 1]);
    expect(queue.isEmpty).toBe(true);
  });

  test("builds a valid heap from an initial list", () => {
    const queue = numbers([4, 10, 3, 5, 1, 8]);
    expect(queue.peek()).toBe(10);
    expect(drain(queue)).toEqual([10, 8, 5, 4, 3, 1]);
  });

  test("handles duplicates and a single item", () => {
    expect(drain(numbers([2, 2, 1, 2]))).toEqual([2, 2, 2, 1]);
    const single = numbers([1]);
    expect(single.pop()).toBe(1);
    expect(single.pop()).toBeUndefined();
  });

  test("keeps the heap property under random pushes and pops", () => {
    const rng = createRng("heap");
    const queue = numbers();
    const reference: number[] = [];
    for (let i = 0; i < 2000; i++) {
      if (rng() < 0.6 || reference.length === 0) {
        const n = Math.floor(rng() * 1000);
        queue.push(n);
        reference.push(n);
      } else {
        reference.sort((a, b) => b - a);
        expect(queue.pop()).toBe(reference.shift());
      }
      expect(queue.size).toBe(reference.length);
    }
    expect(drain(queue)).toEqual(reference.sort((a, b) => b - a));
  });

  test("works with objects and a score comparator", () => {
    const queue = new PriorityQueue(
      byScore((t: { id: string; score: number }) => t.score),
      [
        { id: "a", score: 0.2 },
        { id: "b", score: 0.9 },
        { id: "c", score: 0.5 },
      ],
    );
    expect(drain(queue).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  test("a reversed comparator turns it into a min-heap", () => {
    const queue = new PriorityQueue<number>((a, b) => b - a, [3, 1, 2]);
    expect(drain(queue)).toEqual([1, 2, 3]);
  });

  test("take stops at the requested count", () => {
    const queue = numbers([1, 2, 3, 4]);
    expect(queue.take(2)).toEqual([4, 3]);
    expect(queue.size).toBe(2);
    expect(queue.take(10)).toEqual([2, 1]);
  });

  test("clear and toArray (copy in heap order)", () => {
    const queue = numbers([1, 3, 2]);
    const copy = queue.toArray();
    expect(copy[0]).toBe(3);
    expect([...copy].sort()).toEqual([1, 2, 3]);
    copy.push(99);
    expect(queue.size).toBe(3);
    queue.clear();
    expect(queue.isEmpty).toBe(true);
  });

  test("does not mutate the initial list", () => {
    const items = [1, 5, 3];
    numbers(items).pop();
    expect(items).toEqual([1, 5, 3]);
  });
});

describe("topN", () => {
  test("returns the n most played tracks, highest first", () => {
    const plays = [
      { track: "lofi", count: 12 },
      { track: "rock", count: 40 },
      { track: "jazz", count: 7 },
      { track: "pop", count: 25 },
    ];
    const top = topN(
      plays,
      2,
      byScore((p) => p.count),
    );
    expect(top.map((p) => p.track)).toEqual(["rock", "pop"]);
  });

  test("returns everything when n exceeds the input", () => {
    expect(topN([1, 3, 2], 10, (a, b) => a - b)).toEqual([3, 2, 1]);
    expect(topN([], 5, (a: number, b: number) => a - b)).toEqual([]);
  });
});
