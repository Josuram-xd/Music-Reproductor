import { describe, expect, test } from "vitest";
import { loginUrlFor, routeAccess, safeNextPath } from "./routes";

describe("routeAccess", () => {
  test.each([
    ["/login", "guest"],
    ["/register", "guest"],
    ["/forgot-password", "guest"],
    ["/login/extra", "guest"],
    ["/auth/confirm", "public"],
    ["/api/session/heartbeat", "api"],
    ["/api", "api"],
    ["/", "protected"],
    ["/library", "protected"],
    ["/settings/integrations", "protected"],
    ["/loginx", "protected"],
    ["/apix", "protected"],
    ["/auth", "protected"],
  ])("%s → %s", (pathname, expected) => {
    expect(routeAccess(pathname)).toBe(expected);
  });
});

describe("safeNextPath", () => {
  test("keeps internal paths with query strings", () => {
    expect(safeNextPath("/library")).toBe("/library");
    expect(safeNextPath("/library?folder=1#top")).toBe("/library?folder=1#top");
  });

  test.each([null, undefined, "", "library", "https://evil.com", "//evil.com", "/\\evil.com"])(
    "falls back home for %s",
    (next) => {
      expect(safeNextPath(next)).toBe("/library");
    },
  );

  test("never sends a signed-in user back to a guest page", () => {
    expect(safeNextPath("/login")).toBe("/library");
    expect(safeNextPath("/register?x=1")).toBe("/library");
    expect(safeNextPath("/forgot-password")).toBe("/library");
  });
});

describe("loginUrlFor", () => {
  test("plain /login for the home page", () => {
    expect(loginUrlFor("/")).toBe("/login");
    expect(loginUrlFor("/library")).toBe("/login");
  });

  test("keeps the requested path and query in next", () => {
    expect(loginUrlFor("/library", "?folder=1")).toBe("/login?next=%2Flibrary%3Ffolder%3D1");
    expect(loginUrlFor("/", "?q=x")).toBe("/login?next=%2F%3Fq%3Dx");
  });

  test("round-trips through safeNextPath", () => {
    const url = new URL(loginUrlFor("/stats", "?range=week"), "http://x");
    expect(safeNextPath(url.searchParams.get("next"))).toBe("/stats?range=week");
  });
});
