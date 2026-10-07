import { describe, expect, test } from "vitest";
import { type LibraryTrack, toPlayerTrack } from "./tracks";

const row: LibraryTrack = {
  id: "t1",
  folder_id: null,
  source: "audio",
  origin: "video",
  title: "Neko Lofi",
  artist: null,
  // numeric columns can arrive as strings from PostgREST
  duration_s: "183.250" as unknown as number,
  storage_path: "u/t1.m4a",
  external_id: null,
  mime: "audio/mp4",
  size_bytes: 1234,
  cover_path: null,
  created_at: "2026-10-08T00:00:00Z",
};

describe("toPlayerTrack", () => {
  test("maps the row to what the player needs", () => {
    expect(toPlayerTrack(row)).toEqual({
      id: "t1",
      source: "audio",
      title: "Neko Lofi",
      artist: null,
      durationS: 183.25,
      storagePath: "u/t1.m4a",
      externalId: null,
    });
  });

  test("keeps an unknown duration as null", () => {
    expect(toPlayerTrack({ ...row, duration_s: null }).durationS).toBeNull();
  });
});
