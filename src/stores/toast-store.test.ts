import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toast, useToastStore } from "./toast-store";

const messages = () => useToastStore.getState().toasts.map((t) => t.message);

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

describe("toast store", () => {
  test("shows and auto-dismisses a toast", () => {
    toast("¡Nya~! Canción añadida");
    expect(messages()).toEqual(["¡Nya~! Canción añadida"]);
    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual([]);
  });

  test("custom tone and duration", () => {
    toast("Ojo", { tone: "warn", durationMs: 1000 });
    expect(useToastStore.getState().toasts[0]?.tone).toBe("warn");
    vi.advanceTimersByTime(1000);
    expect(messages()).toEqual([]);
  });

  test("the same message is not stacked twice", () => {
    const first = toast("Es la primera canción");
    const second = toast("Es la primera canción");
    expect(second).toBe(first);
    expect(messages()).toHaveLength(1);
  });

  test("keeps at most 3 toasts", () => {
    for (const m of ["a", "b", "c", "d"]) toast(m);
    expect(messages()).toEqual(["b", "c", "d"]);
  });

  test("dismiss removes a toast early", () => {
    const id = toast("bye", { durationMs: 0 });
    useToastStore.getState().dismiss(id);
    expect(messages()).toEqual([]);
  });
});
