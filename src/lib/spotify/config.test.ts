import { describe, expect, test } from "vitest";
import { spotifyOAuthOrigin } from "./config";

describe("spotifyOAuthOrigin", () => {
  test("uses the IP loopback host when local development uses localhost", () => {
    expect(spotifyOAuthOrigin("http://localhost:3000")).toBe("http://127.0.0.1:3000");
  });

  test("preserves production origins and an existing loopback IP", () => {
    expect(spotifyOAuthOrigin("https://purrlist.example")).toBe("https://purrlist.example");
    expect(spotifyOAuthOrigin("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });
});
