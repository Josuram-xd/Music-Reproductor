import { describe, expect, test } from "vitest";
import { parseFloatingPosition, parseSettingsPatch } from "./settings";

describe("parseFloatingPosition", () => {
  test("accepts an edge and a height fraction, clamped", () => {
    expect(parseFloatingPosition({ edge: "left", y: 0.3 })).toEqual({ edge: "left", y: 0.3 });
    expect(parseFloatingPosition({ edge: "right", y: 7 })).toEqual({ edge: "right", y: 1 });
    expect(parseFloatingPosition({ edge: "right", y: -1 })).toEqual({ edge: "right", y: 0 });
  });

  test.each([null, "x", { edge: "top", y: 0.5 }, { edge: "left" }, { edge: "left", y: NaN }])(
    "rejects %o",
    (value) => {
      expect(parseFloatingPosition(value)).toBeNull();
    },
  );
});

describe("parseSettingsPatch", () => {
  test("keeps only known, valid keys", () => {
    expect(parseSettingsPatch({ floatingPlayer: false, hacker: true })).toEqual({
      floatingPlayer: false,
    });
    expect(
      parseSettingsPatch({ floatingPos: { edge: "left", y: 0.5 }, radioEnabled: true }),
    ).toEqual({ floatingPos: { edge: "left", y: 0.5 }, radioEnabled: true });
    expect(parseSettingsPatch({ floatingPos: null })).toEqual({ floatingPos: null });
  });

  test("rejects wrong types and empty patches", () => {
    expect(parseSettingsPatch({ floatingPlayer: "yes" })).toBeNull();
    expect(parseSettingsPatch({ floatingPos: { edge: "up", y: 1 } })).toBeNull();
    expect(parseSettingsPatch({})).toBeNull();
    expect(parseSettingsPatch(null)).toBeNull();
  });
});
