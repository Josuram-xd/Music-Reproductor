import { describe, expect, test } from "vitest";
import { addYouTubeThumbnails, resultToTrack, youtubeTrackId } from "./tracks";

describe("YouTube tracks", () => {
  test("a result becomes a playable track outside the library", () => {
    expect(
      resultToTrack({
        videoId: "aaaaaaaaaaa",
        title: "Nyan",
        channel: "Cats",
        durationS: 60,
        thumbnail: "",
      }),
    ).toEqual({
      id: youtubeTrackId("aaaaaaaaaaa"),
      source: "youtube",
      title: "Nyan",
      artist: "Cats",
      durationS: 60,
      externalId: "aaaaaaaaaaa",
      coverUrl: null,
    });
    expect(youtubeTrackId("aaaaaaaaaaa")).toBe("yt:aaaaaaaaaaa");
  });

  test("an empty channel is an unknown artist", () => {
    expect(
      resultToTrack({ videoId: "b", title: "x", channel: "", durationS: null, thumbnail: "" })
        .artist,
    ).toBeNull();
  });

  test("library YouTube rows get their thumbnail as cover", () => {
    const rows = [
      { source: "youtube", external_id: "aaaaaaaaaaa", cover_url: null },
      { source: "audio", external_id: null, cover_url: null },
      { source: "youtube", external_id: "bbbbbbbbbbb", cover_url: "custom" },
    ];
    addYouTubeThumbnails(rows);
    expect(rows.map((r) => r.cover_url)).toEqual([
      "https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg",
      null,
      "custom",
    ]);
  });
});
