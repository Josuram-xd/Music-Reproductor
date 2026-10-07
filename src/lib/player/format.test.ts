import { describe, expect, test } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  test.each([
    [0, "0:00"],
    [7.9, "0:07"],
    [83, "1:23"],
    [225, "3:45"],
    [3727, "1:02:07"],
    [-5, "0:00"],
    [NaN, "0:00"],
    [Infinity, "0:00"],
  ])("%d s → %s", (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });
});
