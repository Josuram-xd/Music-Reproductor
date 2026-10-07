import { describe, expect, test } from "vitest";
import { Stack } from "./stack";

describe("Stack", () => {
  test("empieza vacía", () => {
    const stack = new Stack<number>();
    expect(stack.isEmpty).toBe(true);
    expect(stack.size).toBe(0);
    expect(stack.pop()).toBeUndefined();
    expect(stack.peek()).toBeUndefined();
  });

  test("LIFO: push, peek y pop", () => {
    const stack = new Stack<number>();
    stack.push(1);
    stack.push(2);
    stack.push(3);
    expect(stack.peek()).toBe(3);
    expect(stack.size).toBe(3);
    expect(stack.pop()).toBe(3);
    expect(stack.pop()).toBe(2);
    expect(stack.pop()).toBe(1);
    expect(stack.isEmpty).toBe(true);
  });

  test("con capacidad descarta el más antiguo", () => {
    const stack = new Stack<number>(2);
    stack.push(1);
    stack.push(2);
    stack.push(3);
    expect(stack.toArray()).toEqual([2, 3]);
  });

  test("rechaza capacidades no positivas", () => {
    expect(() => new Stack(0)).toThrow(RangeError);
    expect(() => new Stack(-1)).toThrow(RangeError);
    expect(() => new Stack(NaN)).toThrow(RangeError);
  });

  test("clear y toArray (copia, de fondo a cima)", () => {
    const stack = new Stack<string>();
    stack.push("a");
    stack.push("b");
    const snapshot = stack.toArray();
    snapshot.push("x");
    expect(stack.toArray()).toEqual(["a", "b"]);
    stack.clear();
    expect(stack.isEmpty).toBe(true);
  });
});
