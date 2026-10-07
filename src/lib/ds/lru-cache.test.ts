import { describe, expect, test, vi } from "vitest";
import { LRUCache } from "./lru-cache";

/** Manual clock so expiry can be tested without waiting. */
const fakeClock = () => {
  let time = 0;
  return { now: () => time, advance: (ms: number) => void (time += ms) };
};

describe("LRUCache", () => {
  test("validates options", () => {
    expect(() => new LRUCache({ capacity: 0 })).toThrow(RangeError);
    expect(() => new LRUCache({ capacity: 1.5 })).toThrow(RangeError);
    expect(() => new LRUCache({ capacity: 1, ttlMs: 0 })).toThrow(RangeError);
  });

  test("set, get, has and size", () => {
    const cache = new LRUCache<string, number>({ capacity: 2 });
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.has("a")).toBe(true);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  test("evicts the least recently used entry", () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string, number>({ capacity: 2, onEvict });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    expect(cache.has("b")).toBe(false);
    expect(cache.keys()).toEqual(["c", "a"]);
    expect(onEvict).toHaveBeenCalledExactlyOnceWith("b", 2);
  });

  test("peek does not change recency", () => {
    const cache = new LRUCache<string, number>({ capacity: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.peek("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.has("a")).toBe(false);
  });

  test("set on an existing key updates the value and recency", () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string, number>({ capacity: 2, onEvict });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10);
    expect(cache.size).toBe(2);
    expect(cache.keys()).toEqual(["a", "b"]);
    expect(cache.get("a")).toBe(10);
    expect(onEvict).toHaveBeenCalledExactlyOnceWith("a", 1);
  });

  test("re-setting the same value does not call onEvict", () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string, string>({ capacity: 2, onEvict });
    cache.set("a", "blob:1");
    cache.set("a", "blob:1");
    expect(onEvict).not.toHaveBeenCalled();
  });

  test("delete and clear notify onEvict", () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string, number>({ capacity: 3, onEvict });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.delete("b")).toBe(true);
    expect(cache.delete("b")).toBe(false);
    expect(cache.keys()).toEqual(["c", "a"]);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.keys()).toEqual([]);
    expect(onEvict).toHaveBeenCalledTimes(3);
  });

  test("capacity 1 keeps only the latest", () => {
    const cache = new LRUCache<string, number>({ capacity: 1 });
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.keys()).toEqual(["b"]);
  });

  test("entries expire after the ttl", () => {
    const clock = fakeClock();
    const onEvict = vi.fn();
    const cache = new LRUCache<string, string>({
      capacity: 5,
      ttlMs: 1000,
      onEvict,
      now: clock.now,
    });
    cache.set("song", "https://signed/1");
    clock.advance(999);
    expect(cache.get("song")).toBe("https://signed/1");
    clock.advance(1);
    expect(cache.has("song")).toBe(false);
    expect(cache.get("song")).toBeUndefined();
    expect(cache.size).toBe(0);
    expect(onEvict).toHaveBeenCalledExactlyOnceWith("song", "https://signed/1");
  });

  test("per-entry ttl overrides the default", () => {
    const clock = fakeClock();
    const cache = new LRUCache<string, number>({ capacity: 5, ttlMs: 1000, now: clock.now });
    cache.set("short", 1, 100);
    cache.set("default", 2);
    clock.advance(100);
    expect(cache.peek("short")).toBeUndefined();
    expect(cache.peek("default")).toBe(2);
  });

  test("keys skips expired entries and prune removes them", () => {
    const clock = fakeClock();
    const cache = new LRUCache<string, number>({ capacity: 5, now: clock.now });
    cache.set("a", 1, 100);
    cache.set("b", 2);
    clock.advance(100);
    expect(cache.keys()).toEqual(["b"]);
    expect(cache.size).toBe(2);
    cache.prune();
    expect(cache.size).toBe(1);
  });
});
