import { describe, expect, test } from "vitest";
import { DoublyLinkedList } from "./doubly-linked-list";
import { type Command, UndoManager } from "./undo-manager";

/** Comando de ejemplo: mueve `id` a `toIndex` y recuerda de dónde venía. */
function moveCommand(list: DoublyLinkedList<string>, id: string, toIndex: number): Command {
  let from = -1;
  return {
    label: `mover ${id}`,
    execute() {
      from = list.indexOf(id);
      list.moveTo(id, toIndex);
    },
    undo() {
      list.moveTo(id, from);
    },
  };
}

const counter = () => {
  const state = { value: 0 };
  const add = (n: number): Command => ({
    execute: () => void (state.value += n),
    undo: () => void (state.value -= n),
  });
  return { state, add };
};

describe("UndoManager", () => {
  test("sin historial no hace nada", () => {
    const manager = new UndoManager();
    expect(manager.canUndo).toBe(false);
    expect(manager.canRedo).toBe(false);
    expect(manager.undo()).toBeUndefined();
    expect(manager.redo()).toBeUndefined();
  });

  test("execute, undo y redo", () => {
    const { state, add } = counter();
    const manager = new UndoManager();
    manager.execute(add(1));
    manager.execute(add(10));
    expect(state.value).toBe(11);

    manager.undo();
    expect(state.value).toBe(1);
    expect(manager.canRedo).toBe(true);

    manager.undo();
    expect(state.value).toBe(0);
    expect(manager.canUndo).toBe(false);

    manager.redo();
    manager.redo();
    expect(state.value).toBe(11);
    expect(manager.canRedo).toBe(false);
  });

  test("un comando nuevo vacía el redo", () => {
    const { state, add } = counter();
    const manager = new UndoManager();
    manager.execute(add(1));
    manager.undo();
    manager.execute(add(5));
    expect(manager.canRedo).toBe(false);
    expect(state.value).toBe(5);
  });

  test("undo/redo devuelven el comando y peek lo muestra", () => {
    const { add } = counter();
    const manager = new UndoManager();
    const cmd = { ...add(1), label: "sumar" };
    manager.execute(cmd);
    expect(manager.peekUndo()).toBe(cmd);
    expect(manager.undo()).toBe(cmd);
    expect(manager.peekRedo()?.label).toBe("sumar");
    expect(manager.redo()).toBe(cmd);
  });

  test("clear vacía ambas pilas", () => {
    const { add } = counter();
    const manager = new UndoManager();
    manager.execute(add(1));
    manager.execute(add(2));
    manager.undo();
    manager.clear();
    expect(manager.canUndo).toBe(false);
    expect(manager.canRedo).toBe(false);
  });

  test("respeta el límite de historial", () => {
    const { state, add } = counter();
    const manager = new UndoManager(2);
    manager.execute(add(1));
    manager.execute(add(2));
    manager.execute(add(3));
    manager.undo();
    manager.undo();
    expect(manager.canUndo).toBe(false);
    expect(state.value).toBe(1);
  });

  test("si un comando lanza, las pilas no cambian", () => {
    const manager = new UndoManager();
    let fail = false;
    manager.execute({
      execute() {},
      undo() {
        if (fail) throw new Error("boom");
      },
    });
    fail = true;
    expect(() => manager.undo()).toThrow("boom");
    expect(manager.canUndo).toBe(true);
    expect(manager.canRedo).toBe(false);

    const failing: Command = {
      execute() {
        throw new Error("nope");
      },
      undo() {},
    };
    expect(() => manager.execute(failing)).toThrow("nope");
    expect(manager.peekUndo()).not.toBe(failing);
  });

  test('deshace movimientos en la cola ("fue un error")', () => {
    const queue = new DoublyLinkedList<string>((s) => s, ["a", "b", "c", "d"]);
    const manager = new UndoManager();

    manager.execute(moveCommand(queue, "d", 0));
    expect(queue.toArray()).toEqual(["d", "a", "b", "c"]);
    manager.execute(moveCommand(queue, "a", 3));
    expect(queue.toArray()).toEqual(["d", "b", "c", "a"]);

    manager.undo();
    expect(queue.toArray()).toEqual(["d", "a", "b", "c"]);
    manager.undo();
    expect(queue.toArray()).toEqual(["a", "b", "c", "d"]);

    manager.redo();
    expect(queue.toArray()).toEqual(["d", "a", "b", "c"]);
  });
});
