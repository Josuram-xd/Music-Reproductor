import { describe, expect, test } from "vitest";
import { DoublyLinkedList } from "./doubly-linked-list";

interface Song {
  id: string;
  title: string;
}

const song = (id: string): Song => ({ id, title: `Canción ${id}` });
const ids = (list: DoublyLinkedList<Song>) => list.toArray().map((s) => s.id);
const make = (...keys: string[]) => new DoublyLinkedList<Song>((s) => s.id, keys.map(song));

/** Comprueba que los enlaces prev coinciden con el orden hacia delante. */
function expectConsistent(list: DoublyLinkedList<Song>) {
  const forward = ids(list);
  const backward: string[] = [];
  let current = list.last;
  while (current) {
    backward.unshift(current.id);
    current = list.prevOf(current.id);
  }
  expect(backward).toEqual(forward);
  expect(list.size).toBe(forward.length);
  expect(list.first?.id).toBe(forward[0]);
  expect(list.last?.id).toBe(forward[forward.length - 1]);
}

describe("DoublyLinkedList", () => {
  test("empieza vacía", () => {
    const list = make();
    expect(list.size).toBe(0);
    expect(list.isEmpty).toBe(true);
    expect(list.first).toBeUndefined();
    expect(list.last).toBeUndefined();
    expect(list.toArray()).toEqual([]);
  });

  test("append, prepend y constructor con valores", () => {
    const list = make("b");
    list.append(song("c"));
    list.prepend(song("a"));
    expect(ids(list)).toEqual(["a", "b", "c"]);
    expectConsistent(list);
  });

  test("get, has y navegación nextOf / prevOf", () => {
    const list = make("a", "b", "c");
    expect(list.get("b")?.title).toBe("Canción b");
    expect(list.has("z")).toBe(false);
    expect(list.nextOf("a")?.id).toBe("b");
    expect(list.nextOf("c")).toBeUndefined();
    expect(list.prevOf("a")).toBeUndefined();
    expect(list.prevOf("c")?.id).toBe("b");
  });

  test("rechaza ids duplicados", () => {
    const list = make("a");
    expect(() => list.append(song("a"))).toThrow(/ya está/);
    expect(list.size).toBe(1);
  });

  test("lanza con ids inexistentes", () => {
    const list = make("a");
    expect(() => list.nextOf("z")).toThrow(/No existe/);
    expect(() => list.insertAfter("z", song("b"))).toThrow(/No existe/);
    expect(() => list.moveAfter("a", "z")).toThrow(/No existe/);
    expect(list.size).toBe(1);
  });

  test("insertAfter / insertBefore en medio y extremos", () => {
    const list = make("a", "c");
    list.insertAfter("a", song("b"));
    list.insertAfter("c", song("d"));
    list.insertBefore("a", song("0"));
    list.insertBefore("d", song("c2"));
    expect(ids(list)).toEqual(["0", "a", "b", "c", "c2", "d"]);
    expectConsistent(list);
  });

  test("remove de cabeza, medio, cola y único", () => {
    const list = make("a", "b", "c", "d");
    expect(list.remove("a")?.id).toBe("a");
    expect(list.remove("c")?.id).toBe("c");
    expect(list.remove("d")?.id).toBe("d");
    expect(ids(list)).toEqual(["b"]);
    expectConsistent(list);
    list.remove("b");
    expect(list.isEmpty).toBe(true);
    expect(list.remove("b")).toBeUndefined();
    expectConsistent(list);
  });

  test("un id quitado se puede volver a añadir", () => {
    const list = make("a", "b");
    list.remove("a");
    list.append(song("a"));
    expect(ids(list)).toEqual(["b", "a"]);
  });

  test("moveAfter: al principio, al final, en medio y no-op", () => {
    const list = make("a", "b", "c", "d");
    list.moveAfter("d", null);
    expect(ids(list)).toEqual(["d", "a", "b", "c"]);
    list.moveAfter("d", "c");
    expect(ids(list)).toEqual(["a", "b", "c", "d"]);
    list.moveAfter("a", "c");
    expect(ids(list)).toEqual(["b", "c", "a", "d"]);
    list.moveAfter("a", "c");
    expect(ids(list)).toEqual(["b", "c", "a", "d"]);
    expectConsistent(list);
    expect(() => list.moveAfter("a", "a")).toThrow();
  });

  test("moveBefore, incluido el vecino inmediato", () => {
    const list = make("a", "b", "c");
    list.moveBefore("c", "a");
    expect(ids(list)).toEqual(["c", "a", "b"]);
    list.moveBefore("a", "b");
    expect(ids(list)).toEqual(["c", "a", "b"]);
    list.moveBefore("b", "a");
    expect(ids(list)).toEqual(["c", "b", "a"]);
    expectConsistent(list);
    expect(() => list.moveBefore("a", "a")).toThrow();
  });

  test("moveTo coloca el elemento en el índice indicado", () => {
    const list = make("a", "b", "c", "d");
    list.moveTo("a", 3);
    expect(ids(list)).toEqual(["b", "c", "d", "a"]);
    list.moveTo("a", 0);
    expect(ids(list)).toEqual(["a", "b", "c", "d"]);
    list.moveTo("d", 1);
    expect(ids(list)).toEqual(["a", "d", "b", "c"]);
    list.moveTo("d", 1);
    expect(ids(list)).toEqual(["a", "d", "b", "c"]);
    expectConsistent(list);
  });

  test("moveTo es reversible con indexOf (base del undo)", () => {
    const list = make("a", "b", "c", "d", "e");
    const before = ids(list);
    const from = list.indexOf("b");
    list.moveTo("b", 4);
    list.moveTo("b", from);
    expect(ids(list)).toEqual(before);
  });

  test("moveTo valida el índice", () => {
    const list = make("a", "b");
    expect(() => list.moveTo("a", 2)).toThrow(RangeError);
    expect(() => list.moveTo("a", -1)).toThrow(RangeError);
    expect(() => list.moveTo("a", 0.5)).toThrow(RangeError);
    expect(ids(list)).toEqual(["a", "b"]);
  });

  test("indexOf y at", () => {
    const list = make("a", "b", "c");
    expect(list.indexOf("c")).toBe(2);
    expect(list.indexOf("z")).toBe(-1);
    expect(list.at(1)?.id).toBe("b");
    expect(list.at(3)).toBeUndefined();
    expect(list.at(-1)).toBeUndefined();
  });

  test("clear vacía lista e índice", () => {
    const list = make("a", "b");
    list.clear();
    expect(list.isEmpty).toBe(true);
    expect(list.has("a")).toBe(false);
    list.append(song("a"));
    expect(ids(list)).toEqual(["a"]);
  });

  test("toArray devuelve una copia", () => {
    const list = make("a");
    list.toArray().push(song("x"));
    expect(list.size).toBe(1);
  });
});
