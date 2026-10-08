import { describe, expect, test } from "vitest";
import {
  applyLibraryChange,
  buildFolderTree,
  canMoveFolder,
  type LibraryFolder,
  type LibraryState,
  validateFolderName,
} from "./folders";
import type { LibraryTrack } from "./tracks";

const folder = (id: string, parent_id: string | null, name = id): LibraryFolder => ({
  id,
  parent_id,
  name,
});

const track = (id: string, folder_id: string | null) =>
  ({ id, folder_id, title: id }) as LibraryTrack;

// music ─┬─ rock ── metal
//        └─ lofi
// podcasts
const folders = [
  folder("rock", "music", "Rock"),
  folder("music", null, "Music"),
  folder("metal", "rock", "Metal"),
  folder("lofi", "music", "Lofi"),
  folder("podcasts", null, "Podcasts"),
];
const state: LibraryState = {
  folders,
  tracks: [track("t1", "metal"), track("t2", "lofi"), track("t3", null)],
};

describe("validateFolderName", () => {
  test.each([
    ["  Mis   favoritas ", "Mis favoritas"],
    ["Ñañá 🐱", "Ñañá 🐱"],
    ["a".repeat(100), "a".repeat(100)],
  ])("%j → %j", (input, expected) => {
    expect(validateFolderName(input)).toBe(expected);
  });

  test.each(["", "   ", "a".repeat(101), 42, null])("rejects %j", (input) => {
    expect(validateFolderName(input)).toBeNull();
  });
});

describe("buildFolderTree", () => {
  test("builds the hierarchy from rows in any order, siblings by name", () => {
    const tree = buildFolderTree(folders);
    expect(tree.children(null).map((f) => f.name)).toEqual(["Music", "Podcasts"]);
    expect(tree.children("music").map((f) => f.name)).toEqual(["Lofi", "Rock"]);
    expect(tree.path("metal").map((f) => f.id)).toEqual(["music", "rock", "metal"]);
  });

  test("sorts numbers naturally and ignores case/accents", () => {
    const tree = buildFolderTree([folder("b", null, "Disco 10"), folder("a", null, "disco 9")]);
    expect(tree.children(null).map((f) => f.id)).toEqual(["a", "b"]);
  });
});

describe("canMoveFolder", () => {
  test("allows moving to another branch or the root", () => {
    expect(canMoveFolder(folders, "rock", "podcasts")).toBe(true);
    expect(canMoveFolder(folders, "metal", null)).toBe(true);
  });

  test("rejects cycles, no-op moves and unknown folders", () => {
    expect(canMoveFolder(folders, "music", "metal")).toBe(false);
    expect(canMoveFolder(folders, "music", "music")).toBe(false);
    expect(canMoveFolder(folders, "rock", "music")).toBe(false);
    expect(canMoveFolder(folders, "nope", null)).toBe(false);
    expect(canMoveFolder(folders, "rock", "nope")).toBe(false);
  });
});

describe("applyLibraryChange", () => {
  test("create and rename", () => {
    let next = applyLibraryChange(state, {
      type: "create-folder",
      folder: folder("new", "music", "Nueva"),
    });
    next = applyLibraryChange(next, { type: "rename-folder", id: "new", name: "Chill" });
    expect(next.folders.find((f) => f.id === "new")).toEqual(folder("new", "music", "Chill"));
    expect(state.folders).toHaveLength(5); // not mutated
  });

  test("move a folder, ignoring cycles", () => {
    const moved = applyLibraryChange(state, { type: "move-folder", id: "rock", parentId: null });
    expect(moved.folders.find((f) => f.id === "rock")?.parent_id).toBeNull();
    expect(applyLibraryChange(state, { type: "move-folder", id: "music", parentId: "metal" })).toBe(
      state,
    );
  });

  test("deleting a folder removes its subtree and sends its tracks to the root", () => {
    const next = applyLibraryChange(state, { type: "delete-folder", id: "rock" });
    expect(next.folders.map((f) => f.id).sort()).toEqual(["lofi", "music", "podcasts"]);
    expect(next.tracks.map((t) => [t.id, t.folder_id])).toEqual([
      ["t1", null],
      ["t2", "lofi"],
      ["t3", null],
    ]);
  });

  test("move a track", () => {
    const next = applyLibraryChange(state, { type: "move-track", id: "t3", folderId: "podcasts" });
    expect(next.tracks.find((t) => t.id === "t3")?.folder_id).toBe("podcasts");
  });

  test("delete a track without changing its folders or the original state", () => {
    const next = applyLibraryChange(state, { type: "delete-track", id: "t2" });
    expect(next.tracks.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(next.folders).toEqual(state.folders);
    expect(state.tracks.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });
});
