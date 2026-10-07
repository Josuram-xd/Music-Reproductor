// @vitest-environment node
import { describe, expect, test } from "vitest";
import {
  DEFAULT_GRACE_SECONDS,
  formatCountdown,
  graceRemaining,
  isGraceExpired,
  parseGraceSeconds,
  signLastSeen,
  verifyLastSeen,
} from "./grace";

const SECRET = "test-secret-32-bytes-long-enough!";
const USER = "user-1";
const T = 1_760_000_000_000;

describe("signLastSeen / verifyLastSeen", () => {
  test("round-trips the timestamp", async () => {
    const value = await signLastSeen(USER, T, SECRET);
    expect(value.startsWith(`${T}.`)).toBe(true);
    expect(value).not.toMatch(/[+/=]/);
    expect(await verifyLastSeen(value, USER, SECRET)).toBe(T);
  });

  test("rejects a cookie from another user", async () => {
    const value = await signLastSeen(USER, T, SECRET);
    expect(await verifyLastSeen(value, "user-2", SECRET)).toBeNull();
  });

  test("rejects a cookie signed with another secret", async () => {
    const value = await signLastSeen(USER, T, "other-secret");
    expect(await verifyLastSeen(value, USER, SECRET)).toBeNull();
  });

  test("rejects a moved timestamp (cannot extend the window)", async () => {
    const value = await signLastSeen(USER, T, SECRET);
    const forged = value.replace(String(T), String(T + 60_000));
    expect(await verifyLastSeen(forged, USER, SECRET)).toBeNull();
  });

  test.each([undefined, "", "abc", ".sig", "123", "12a.sig", "123.", `${T}.bad-signature`])(
    "rejects malformed value %s",
    async (value) => {
      expect(await verifyLastSeen(value, USER, SECRET)).toBeNull();
    },
  );
});

describe("grace window", () => {
  test("graceRemaining counts down and never goes negative", () => {
    expect(graceRemaining(T, T, 300)).toBe(300);
    expect(graceRemaining(T, T + 28_500, 300)).toBe(272);
    expect(graceRemaining(T, T + 300_000, 300)).toBe(0);
    expect(graceRemaining(T, T + 999_999, 300)).toBe(0);
  });

  test("isGraceExpired only after the full grace", () => {
    expect(isGraceExpired(T, T + 300_000, 300)).toBe(false);
    expect(isGraceExpired(T, T + 300_001, 300)).toBe(true);
  });

  test("formatCountdown", () => {
    expect(formatCountdown(272)).toBe("4:32");
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  test("parseGraceSeconds falls back on bad input", () => {
    expect(parseGraceSeconds("120")).toBe(120);
    expect(parseGraceSeconds(undefined)).toBe(DEFAULT_GRACE_SECONDS);
    expect(parseGraceSeconds("")).toBe(DEFAULT_GRACE_SECONDS);
    expect(parseGraceSeconds("abc")).toBe(DEFAULT_GRACE_SECONDS);
    expect(parseGraceSeconds("-1")).toBe(DEFAULT_GRACE_SECONDS);
    expect(parseGraceSeconds("1.5")).toBe(DEFAULT_GRACE_SECONDS);
  });
});
