import { describe, expect, test } from "vitest";
import { type Folder, FolderTree } from "./folder-tree";

const folder = (id: string, parentId: string | null = null): Folder => ({
  id,
  name: id.toUpperCase(),
  parentId,
});

/**
 * music
 * ├─ rock
 * │  └─ 80s
 * └─ lofi
 * podcasts
 */
const sample = () =>
  FolderTree.fromList([
    folder("music"),
    folder("rock", "music"),
    folder("80s", "rock"),
    folder("lofi", "music"),
    folder("podcasts"),
  ]);

const outline = (tree: FolderTree) =>
  [...tree.traverse()].map((e) => `${"-".repeat(e.depth)}${e.folder.id}`);

describe("FolderTree", () => {
  test("starts empty", () => {
    const tree = new FolderTree();
    expect(tree.size).toBe(0);
    expect(tree.children(null)).toEqual([]);
    expect(tree.toArray()).toEqual([]);
  });

  test("add builds the hierarchy", () => {
    const tree = sample();
    expect(tree.size).toBe(5);
    expect(tree.children(null).map((f) => f.id)).toEqual(["music", "podcasts"]);
    expect(tree.children("music").map((f) => f.id)).toEqual(["rock", "lofi"]);
    expect(tree.get("80s")).toEqual(folder("80s", "rock"));
    expect(tree.has("jazz")).toBe(false);
    expect(tree.get("jazz")).toBeUndefined();
  });

  test("add rejects duplicates and unknown parents", () => {
    const tree = sample();
    expect(() => tree.add(folder("rock"))).toThrow(/already exists/);
    expect(() => tree.add(folder("x", "nope"))).toThrow(/does not exist/);
    expect(tree.size).toBe(5);
  });

  test("fromList accepts rows in any order", () => {
    const tree = FolderTree.fromList([
      folder("80s", "rock"),
      folder("rock", "music"),
      folder("music"),
    ]);
    expect(outline(tree)).toEqual(["music", "-rock", "--80s"]);
  });

  test("fromList rejects missing parents, duplicates and cycles", () => {
    expect(() => FolderTree.fromList([folder("a", "ghost")])).toThrow(/does not exist/);
    expect(() => FolderTree.fromList([folder("a"), folder("a")])).toThrow(/Duplicate/);
    expect(() => FolderTree.fromList([folder("a", "b"), folder("b", "a")])).toThrow(/Cycle/);
    expect(() => FolderTree.fromList([folder("a", "a")])).toThrow(/Cycle/);
  });

  test("traverse walks depth-first in preorder with depth", () => {
    const tree = sample();
    expect(outline(tree)).toEqual(["music", "-rock", "--80s", "-lofi", "podcasts"]);
    expect([...tree.traverse("rock")].map((e) => [e.folder.id, e.depth])).toEqual([
      ["rock", 0],
      ["80s", 1],
    ]);
  });

  test("path and depth", () => {
    const tree = sample();
    expect(tree.path("80s").map((f) => f.id)).toEqual(["music", "rock", "80s"]);
    expect(tree.path("podcasts").map((f) => f.id)).toEqual(["podcasts"]);
    expect(tree.depth("80s")).toBe(2);
    expect(tree.depth("music")).toBe(0);
    expect(() => tree.path("nope")).toThrow(/does not exist/);
  });

  test("rename", () => {
    const tree = sample();
    tree.rename("lofi", "Lo-fi beats");
    expect(tree.get("lofi")?.name).toBe("Lo-fi beats");
  });

  test("move carries the subtree and updates parentId", () => {
    const tree = sample();
    tree.move("rock", "podcasts");
    expect(outline(tree)).toEqual(["music", "-lofi", "podcasts", "-rock", "--80s"]);
    expect(tree.get("rock")?.parentId).toBe("podcasts");
    tree.move("rock", null);
    expect(tree.children(null).map((f) => f.id)).toEqual(["music", "podcasts", "rock"]);
    expect(tree.get("rock")?.parentId).toBeNull();
  });

  test("move to the same parent is a no-op", () => {
    const tree = sample();
    tree.move("rock", "music");
    expect(tree.children("music").map((f) => f.id)).toEqual(["rock", "lofi"]);
  });

  test("move rejects cycles", () => {
    const tree = sample();
    expect(() => tree.move("music", "music")).toThrow(/descendant/);
    expect(() => tree.move("music", "80s")).toThrow(/descendant/);
    expect(outline(tree)).toEqual(["music", "-rock", "--80s", "-lofi", "podcasts"]);
  });

  test("remove deletes the whole subtree and returns its ids", () => {
    const tree = sample();
    expect(tree.remove("rock")).toEqual(["rock", "80s"]);
    expect(tree.size).toBe(3);
    expect(tree.has("80s")).toBe(false);
    expect(outline(tree)).toEqual(["music", "-lofi", "podcasts"]);
    expect(() => tree.remove("rock")).toThrow(/does not exist/);
    tree.add(folder("rock", "lofi"));
    expect(tree.path("rock").map((f) => f.id)).toEqual(["music", "lofi", "rock"]);
  });

  test("isDescendantOf", () => {
    const tree = sample();
    expect(tree.isDescendantOf("80s", "music")).toBe(true);
    expect(tree.isDescendantOf("rock", "rock")).toBe(true);
    expect(tree.isDescendantOf("music", "rock")).toBe(false);
    expect(tree.isDescendantOf("lofi", "podcasts")).toBe(false);
  });

  test("reads return copies that cannot corrupt the tree", () => {
    const tree = sample();
    const rock = tree.get("rock")!;
    rock.parentId = "podcasts";
    rock.name = "hacked";
    tree.children("music")[0]!.name = "hacked";
    tree.toArray()[0]!.name = "hacked";
    expect(tree.get("rock")).toEqual(folder("rock", "music"));
    expect(tree.get("music")?.name).toBe("MUSIC");
  });

  test("toArray round-trips through fromList (same structure in any order)", () => {
    const tree = sample();
    tree.move("lofi", "podcasts");
    const parents = (t: FolderTree) =>
      Object.fromEntries(t.toArray().map((f) => [f.id, f.parentId]));
    const copy = FolderTree.fromList(tree.toArray().reverse());
    expect(parents(copy)).toEqual(parents(tree));
    expect(FolderTree.fromList(tree.toArray()).toArray()).toEqual(tree.toArray());
  });
});
