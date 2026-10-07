import { describe, expect, test } from "vitest";
import { assertSupabaseApiUrl } from "./env";

describe("assertSupabaseApiUrl", () => {
  test.each([
    "https://rviqswaevfzumcndyckp.supabase.co",
    "https://rviqswaevfzumcndyckp.supabase.co/",
    "http://127.0.0.1:54321",
  ])("accepts the API URL %s", (url) => {
    expect(() => assertSupabaseApiUrl(url)).not.toThrow();
  });

  test("rejects the dashboard URL with a helpful message", () => {
    expect(() =>
      assertSupabaseApiUrl("https://supabase.com/dashboard/project/rviqswaevfzumcndyckp"),
    ).toThrow(/dashboard.*supabase\.co/);
  });

  test("rejects URLs with a path", () => {
    expect(() => assertSupabaseApiUrl("https://abc.supabase.co/rest/v1")).toThrow(/path/);
  });

  test("rejects garbage", () => {
    expect(() => assertSupabaseApiUrl("rviqswaevfzumcndyckp")).toThrow(/not a valid URL/);
  });
});
