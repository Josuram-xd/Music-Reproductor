import { describe, expect, test } from "vitest";
import { type Area, EDGE_MARGIN, freeArea, nudge, snapToEdge, toPixels } from "./floating-position";

const area: Area = { left: 0, top: 56, right: 960, bottom: 800 };
const size = { width: 288, height: 160 };
// Vertical room: 800 - 56 - 160 - 32 = 552
const ROOM = 552;

describe("toPixels", () => {
  test("default: bottom right", () => {
    expect(toPixels(null, size, area)).toEqual({
      x: 960 - EDGE_MARGIN - 288,
      y: 56 + EDGE_MARGIN + ROOM,
    });
  });

  test("left edge, middle height", () => {
    expect(toPixels({ edge: "left", y: 0.5 }, size, area)).toEqual({
      x: EDGE_MARGIN,
      y: 56 + EDGE_MARGIN + ROOM / 2,
    });
  });

  test("stays inside a window smaller than the widget", () => {
    const tiny: Area = { left: 0, top: 0, right: 200, bottom: 100 };
    const point = toPixels({ edge: "right", y: 1 }, size, tiny);
    expect(point).toEqual({ x: EDGE_MARGIN, y: EDGE_MARGIN });
  });
});

describe("snapToEdge", () => {
  test("sticks to the nearest side and keeps the height", () => {
    expect(snapToEdge({ x: 100, y: 56 + EDGE_MARGIN + ROOM / 4 }, size, area)).toEqual({
      edge: "left",
      y: 0.25,
    });
    expect(snapToEdge({ x: 600, y: 2000 }, size, area)).toEqual({ edge: "right", y: 1 });
    expect(snapToEdge({ x: 600, y: -500 }, size, area)).toEqual({ edge: "right", y: 0 });
  });

  test("round trip: snapping where toPixels put it gives the same position", () => {
    const position = { edge: "left" as const, y: 0.7 };
    expect(snapToEdge(toPixels(position, size, area), size, area)).toEqual(position);
  });
});

describe("nudge", () => {
  test("arrows move by a tenth or change edge", () => {
    expect(nudge({ edge: "right", y: 0.5 }, "ArrowUp")).toEqual({ edge: "right", y: 0.4 });
    expect(nudge({ edge: "right", y: 1 }, "ArrowDown")).toEqual({ edge: "right", y: 1 });
    expect(nudge(null, "ArrowLeft")).toEqual({ edge: "left", y: 1 });
    expect(nudge({ edge: "left", y: 0 }, "ArrowRight")).toEqual({ edge: "right", y: 0 });
    expect(nudge(null, "Enter")).toBeNull();
  });
});

describe("freeArea", () => {
  const rect = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
    bottom: top + height,
  });

  test("removes the header, the queue column and the tab bar", () => {
    expect(
      freeArea({ width: 1280, height: 800 }, [
        { side: "top", rect: rect(0, 0, 960, 56) },
        { side: "right", rect: rect(960, 0, 320, 800) },
        { side: "bottom", rect: rect(0, 744, 1280, 56) },
      ]),
    ).toEqual({ left: 0, top: 56, right: 960, bottom: 744 });
  });

  test("hidden parts (zero size) are ignored", () => {
    expect(
      freeArea({ width: 400, height: 700 }, [{ side: "right", rect: rect(0, 0, 0, 0) }]),
    ).toEqual({ left: 0, top: 0, right: 400, bottom: 700 });
  });
});
