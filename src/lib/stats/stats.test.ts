import { describe, expect, test } from "vitest";
import { cleanTimeZone, formatClock, formatDays, formatDuration } from "./format";
import { EMPTY_SUMMARY, toSummary } from "./summary";

describe("stats format", () => {
  test.each([
    [0, "0 s"],
    [45.4, "45 s"],
    [60, "1 min"],
    [59 * 60, "59 min"],
    [2 * 3600 + 5 * 60, "2 h 05 min"],
    [-3, "0 s"],
    [Number.NaN, "0 s"],
  ])("formatDuration(%s) = %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });

  test("formatClock", () => {
    expect(formatClock(272)).toBe("4:32");
    expect(formatClock(3727)).toBe("1:02:07");
    expect(formatClock(-1)).toBe("0:00");
  });

  test("formatDays", () => {
    expect(formatDays(1)).toBe("1 día");
    expect(formatDays(0)).toBe("0 días");
    expect(formatDays(5)).toBe("5 días");
  });

  test("cleanTimeZone accepts real IANA zones only", () => {
    expect(cleanTimeZone("Europe/Madrid")).toBe("Europe/Madrid");
    expect(cleanTimeZone("America/Argentina/Buenos_Aires")).toBe("America/Argentina/Buenos_Aires");
    expect(cleanTimeZone("Mars/Olympus")).toBe("UTC");
    expect(cleanTimeZone("'; drop table x; --")).toBe("UTC");
    expect(cleanTimeZone(null)).toBe("UTC");
  });
});

describe("toSummary", () => {
  test("turns Postgres numerics (strings) into numbers", () => {
    expect(
      toSummary({
        listened_s: "3600.500",
        plays: "12",
        audio_s: "3000",
        youtube_s: "600.5",
        spotify_s: "0",
        usage_s: "7200",
        session_started_at: "2026-10-07T10:00:00Z",
        streak_days: 3,
      }),
    ).toEqual({
      listenedS: 3600.5,
      plays: 12,
      bySource: { audio: 3000, youtube: 600.5, spotify: 0 },
      usageS: 7200,
      sessionStartedAt: "2026-10-07T10:00:00Z",
      streakDays: 3,
    });
  });

  test("no row means nothing yet", () => {
    expect(toSummary(undefined)).toEqual(EMPTY_SUMMARY);
  });
});
