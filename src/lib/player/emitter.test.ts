import { describe, expect, test, vi } from "vitest";
import { Emitter } from "./emitter";

interface Events {
  ping: number;
  done: void;
}

describe("Emitter", () => {
  test("delivers payloads to every listener of the event", () => {
    const emitter = new Emitter<Events>();
    const a = vi.fn();
    const b = vi.fn();
    const other = vi.fn();
    emitter.on("ping", a);
    emitter.on("ping", b);
    emitter.on("done", other);

    emitter.emit("ping", 7);
    expect(a).toHaveBeenCalledWith(7);
    expect(b).toHaveBeenCalledWith(7);
    expect(other).not.toHaveBeenCalled();
  });

  test("unsubscribe and clear", () => {
    const emitter = new Emitter<Events>();
    const listener = vi.fn();
    const off = emitter.on("ping", listener);
    off();
    emitter.emit("ping", 1);
    emitter.on("ping", listener);
    emitter.clear();
    emitter.emit("ping", 2);
    expect(listener).not.toHaveBeenCalled();
  });

  test("a throwing listener does not stop the others", () => {
    const emitter = new Emitter<Events>();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const after = vi.fn();
    emitter.on("done", () => {
      throw new Error("boom");
    });
    emitter.on("done", after);

    emitter.emit("done", undefined);
    expect(after).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  test("a listener may unsubscribe itself while emitting", () => {
    const emitter = new Emitter<Events>();
    const calls: string[] = [];
    const off = emitter.on("ping", () => {
      calls.push("once");
      off();
    });
    emitter.on("ping", () => calls.push("always"));
    emitter.emit("ping", 1);
    emitter.emit("ping", 2);
    expect(calls).toEqual(["once", "always", "always"]);
  });
});
