import { describe, expect, test } from "vitest";
import {
  parsePeriod,
  parseTopSize,
  peakCell,
  periodStart,
  toBySource,
  toHeatmap,
  toRankItems,
} from "./details";

const NOW = Date.parse("2026-10-07T12:00:00Z");

describe("stats details helpers", () => {
  test("periods are rolling windows; unknown values fall back", () => {
    expect(periodStart("week", NOW)).toBe("2026-09-30T12:00:00.000Z");
    expect(periodStart("month", NOW)).toBe("2026-09-07T12:00:00.000Z");
    expect(periodStart("all", NOW)).toBe("1970-01-01T00:00:00.000Z");
    expect(parsePeriod("year")).toBe("month");
    expect(parsePeriod("week")).toBe("week");
    expect(parseTopSize("10")).toBe(10);
    expect(parseTopSize("99")).toBe(5);
  });

  test("rank rows: listened seconds or skips as the value, numbers from strings", () => {
    expect(
      toRankItems([
        { key: "a", label: "Song", sublabel: "Mochi", listened_s: "120.5", plays: "3" },
        { key: "b", label: "Other", sublabel: null, skips: 4, plays: 6 },
      ]),
    ).toEqual([
      { key: "a", label: "Song", sublabel: "Mochi", value: 120.5, plays: 3 },
      { key: "b", label: "Other", sublabel: null, value: 4, plays: 6 },
    ]);
  });

  test("heatmap: a full 7 × 24 grid, ignoring rows out of range", () => {
    const grid = toHeatmap([
      { weekday: 1, hour: 21, listened_s: "600" },
      { weekday: 1, hour: 21, listened_s: 60 },
      { weekday: 9, hour: 3, listened_s: 10 },
    ]);
    expect(grid).toHaveLength(7);
    expect(grid.every((row) => row.length === 24)).toBe(true);
    expect(grid[1]![21]).toBe(660);
    expect(peakCell(grid)).toEqual({ weekday: 1, hour: 21 });
    expect(peakCell(toHeatmap([]))).toBeNull();
  });

  test("time per source, unknown sources ignored", () => {
    expect(
      toBySource([
        { source: "audio", listened_s: "100" },
        { source: "spotify", listened_s: 50 },
        { source: "vinyl", listened_s: 999 },
      ]),
    ).toEqual({ audio: 100, youtube: 0, spotify: 50 });
  });
});
