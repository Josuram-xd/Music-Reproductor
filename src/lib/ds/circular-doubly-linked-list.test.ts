import { describe, expect, test } from "vitest";
import { CircularDoublyLinkedList } from "./circular-doubly-linked-list";
import { DoublyLinkedList } from "./doubly-linked-list";

const make = (...keys: string[]) => new CircularDoublyLinkedList<string>((s) => s, keys);

describe("CircularDoublyLinkedList", () => {
  test("is a DoublyLinkedList", () => {
    expect(make("a")).toBeInstanceOf(DoublyLinkedList);
  });

  test("nextOf the last wraps to the first", () => {
    const list = make("a", "b", "c");
    expect(list.nextOf("a")).toBe("b");
    expect(list.nextOf("c")).toBe("a");
  });

  test("prevOf the first wraps to the last", () => {
    const list = make("a", "b", "c");
    expect(list.prevOf("b")).toBe("a");
    expect(list.prevOf("a")).toBe("c");
  });

  test("a single item points to itself", () => {
    const list = make("a");
    expect(list.nextOf("a")).toBe("a");
    expect(list.prevOf("a")).toBe("a");
  });

  test("the cycle holds after moves and removals", () => {
    const list = make("a", "b", "c");
    list.moveAfter("a", "c");
    expect(list.toArray()).toEqual(["b", "c", "a"]);
    expect(list.nextOf("a")).toBe("b");
    list.remove("b");
    expect(list.nextOf("a")).toBe("c");
    expect(list.prevOf("c")).toBe("a");
  });

  test("cycle wraps around from the given id", () => {
    const list = make("a", "b", "c");
    expect([...list.cycle("b", 7)]).toEqual(["b", "c", "a", "b", "c", "a", "b"]);
    expect([...list.cycle("a", 0)]).toEqual([]);
  });

  test("toArray and iteration stay linear", () => {
    expect([...make("a", "b", "c")]).toEqual(["a", "b", "c"]);
  });

  test("throws on unknown ids", () => {
    const list = make("a");
    expect(() => list.nextOf("z")).toThrow(/not in the list/);
    expect(() => [...list.cycle("z", 1)]).toThrow(/not in the list/);
  });
});
