import { describe, expect, test } from "vitest";
import { cleanYouTubeKey, keyHint } from "./key";

const KEY = `AIza${"a".repeat(35)}`;

describe("YouTube key helpers", () => {
  test("accepts Google API keys, trimmed", () => {
    expect(cleanYouTubeKey(`  ${KEY} `)).toBe(KEY);
  });

  test("rejects anything else", () => {
    expect(cleanYouTubeKey("AIza-short")).toBeNull();
    expect(cleanYouTubeKey(`BIza${"a".repeat(35)}`)).toBeNull();
    expect(cleanYouTubeKey(42)).toBeNull();
  });

  test("the hint shows only the end", () => {
    expect(keyHint(`${KEY.slice(0, -4)}wXyZ`)).toBe("…wXyZ");
  });
});
