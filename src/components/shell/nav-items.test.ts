import { describe, expect, test } from "vitest";
import { isActivePath, NAV_ITEMS } from "./nav-items";

describe("isActivePath", () => {
  test("matches the section and its nested pages only", () => {
    expect(isActivePath("/settings", "/settings")).toBe(true);
    expect(isActivePath("/settings/integrations", "/settings")).toBe(true);
    expect(isActivePath("/settingsx", "/settings")).toBe(false);
    expect(isActivePath("/library", "/settings")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  test("has the four main sections with unique routes", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toEqual(["/library", "/playlists", "/stats", "/settings"]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
