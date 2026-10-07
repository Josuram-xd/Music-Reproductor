import { describe, expect, test } from "vitest";
import { CircularDoublyLinkedList } from "./circular-doubly-linked-list";
import { DoublyLinkedList } from "./doubly-linked-list";

const make = (...keys: string[]) => new CircularDoublyLinkedList<string>((s) => s, keys);

describe("CircularDoublyLinkedList", () => {
  test("es una DoublyLinkedList", () => {
    expect(make("a")).toBeInstanceOf(DoublyLinkedList);
  });

  test("nextOf del último vuelve al primero", () => {
    const list = make("a", "b", "c");
    expect(list.nextOf("a")).toBe("b");
    expect(list.nextOf("c")).toBe("a");
  });

  test("prevOf del primero va al último", () => {
    const list = make("a", "b", "c");
    expect(list.prevOf("b")).toBe("a");
    expect(list.prevOf("a")).toBe("c");
  });

  test("con un solo elemento apunta a sí mismo", () => {
    const list = make("a");
    expect(list.nextOf("a")).toBe("a");
    expect(list.prevOf("a")).toBe("a");
  });

  test("el ciclo se mantiene tras mover y quitar", () => {
    const list = make("a", "b", "c");
    list.moveAfter("a", "c");
    expect(list.toArray()).toEqual(["b", "c", "a"]);
    expect(list.nextOf("a")).toBe("b");
    list.remove("b");
    expect(list.nextOf("a")).toBe("c");
    expect(list.prevOf("c")).toBe("a");
  });

  test("cycle da vueltas desde el id indicado", () => {
    const list = make("a", "b", "c");
    expect([...list.cycle("b", 7)]).toEqual(["b", "c", "a", "b", "c", "a", "b"]);
    expect([...list.cycle("a", 0)]).toEqual([]);
  });

  test("toArray e iteración siguen siendo lineales", () => {
    expect([...make("a", "b", "c")]).toEqual(["a", "b", "c"]);
  });

  test("lanza con ids inexistentes", () => {
    const list = make("a");
    expect(() => list.nextOf("z")).toThrow(/No existe/);
    expect(() => [...list.cycle("z", 1)]).toThrow(/No existe/);
  });
});
