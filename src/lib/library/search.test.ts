import { describe, expect, test } from "vitest";
import type { LibraryFolder } from "./folders";
import { buildLibraryIndex, suggest } from "./search";
import type { LibraryTrack } from "./tracks";

const track = (id: string, title: string, artist: string | null = null) =>
  ({ id, title, artist }) as LibraryTrack;
const folder = (id: string, name: string): LibraryFolder => ({ id, name, parent_id: null });

const index = buildLibraryIndex(
  [
    track("t1", "Tití Me Preguntó", "Bad Bunny"),
    track("t2", "Neko Lofi"),
    track("t3", "Badlands", "Halsey"),
  ],
  [folder("f1", "Lofi para estudiar"), folder("f2", "Baladas")],
);

describe("buildLibraryIndex", () => {
  test("finds tracks by any word of title or artist, ignoring accents", () => {
    expect(index.tracks.search("titi")).toEqual(["t1"]);
    expect(index.tracks.search("bad")).toEqual(expect.arrayContaining(["t1", "t3"]));
    expect(index.tracks.search("bad bun")).toEqual(["t1"]);
    expect(index.tracks.search("lofi")).toEqual(["t2"]);
  });

  test("finds folders by name", () => {
    expect(index.folders.search("estud")).toEqual(["f1"]);
    expect(index.folders.search("bal")).toEqual(["f2"]);
  });
});

describe("suggest", () => {
  test("completes the last word with tracks and folders", () => {
    expect(suggest(index, "ba")).toEqual(["bad", "badlands", "baladas"]);
    expect(suggest(index, "bad bu")).toEqual(["bad bunny"]);
  });

  test("nothing to suggest for empty queries, finished words or exact words", () => {
    expect(suggest(index, "")).toEqual([]);
    expect(suggest(index, "bad ")).toEqual([]);
    expect(suggest(index, "bunny")).toEqual([]);
  });
});
