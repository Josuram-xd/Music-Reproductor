import { describe, expect, test } from "vitest";
import { chooseDockPlacement } from "./youtube-dock";

const viewport = { width: 1280, height: 800 };
const rect = (left: number, top: number, width = 280, height = 158) => ({
  left,
  top,
  width,
  height,
});

describe("chooseDockPlacement", () => {
  test("docks over a visible slot", () => {
    expect(chooseDockPlacement([{ rect: rect(980, 120), clip: null }], viewport)).toEqual({
      mode: "docked",
      ...rect(980, 120),
    });
  });

  test("copies geometry from DOMRects whose properties are not enumerable", () => {
    const domRect = new DOMRect(980, 120, 280, 158);
    expect(chooseDockPlacement([{ rect: domRect, clip: null }], viewport)).toEqual({
      mode: "docked",
      left: 980,
      top: 120,
      width: 280,
      height: 158,
    });
  });

  test("floats when there is no slot or it is hidden (zero size)", () => {
    expect(chooseDockPlacement([], viewport)).toEqual({ mode: "floating" });
    expect(chooseDockPlacement([{ rect: rect(0, 0, 0, 0), clip: null }], viewport)).toEqual({
      mode: "floating",
    });
  });

  test("floats when the slot is scrolled out of its column", () => {
    const column = { left: 960, top: 0, width: 320, height: 800 };
    expect(chooseDockPlacement([{ rect: rect(980, -120), clip: column }], viewport)).toEqual({
      mode: "floating",
    });
  });

  test("a slot mostly inside stays docked", () => {
    const column = { left: 960, top: 0, width: 320, height: 800 };
    expect(chooseDockPlacement([{ rect: rect(980, -40), clip: column }], viewport).mode).toBe(
      "docked",
    );
  });

  test("uses the first visible slot", () => {
    const placement = chooseDockPlacement(
      [
        { rect: rect(0, 2000), clip: null },
        { rect: rect(980, 100), clip: null },
      ],
      viewport,
    );
    expect(placement).toEqual({ mode: "docked", ...rect(980, 100) });
  });
});
