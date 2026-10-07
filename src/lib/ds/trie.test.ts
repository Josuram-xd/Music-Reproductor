import { describe, expect, test } from "vitest";
import { normalize, tokenize, Trie } from "./trie";

const library = () => {
  const trie = new Trie<string>();
  trie.insertText("Tití Me Preguntó · Bad Bunny", "t1");
  trie.insertText("Me Porto Bonito · Bad Bunny", "t2");
  trie.insertText("Bohemian Rhapsody · Queen", "t3");
  trie.insertText("Canción del Mariachi · Antonio Banderas", "t4");
  return trie;
};

describe("normalize / tokenize", () => {
  test("lowercases and strips accents", () => {
    expect(normalize("  Canción ÑANDÚ  ")).toBe("cancion nandu");
  });

  test("splits into words, ignoring symbols", () => {
    expect(tokenize("AC/DC — Back in Black (1980)")).toEqual([
      "ac",
      "dc",
      "back",
      "in",
      "black",
      "1980",
    ]);
    expect(tokenize("  · ")).toEqual([]);
  });
});

describe("Trie", () => {
  test("starts empty", () => {
    const trie = new Trie<string>();
    expect(trie.size).toBe(0);
    expect(trie.searchPrefix("a")).toEqual([]);
    expect(trie.complete("a")).toEqual([]);
  });

  test("insert and has match whole words only", () => {
    const trie = new Trie<number>();
    trie.insert("Queen", 1);
    expect(trie.has("queen")).toBe(true);
    expect(trie.has("QUEEN")).toBe(true);
    expect(trie.has("que")).toBe(false);
    expect(trie.has("queens")).toBe(false);
  });

  test("ignores empty words", () => {
    const trie = new Trie<number>();
    trie.insert("   ", 1);
    expect(trie.size).toBe(0);
  });

  test("size counts distinct words", () => {
    const trie = new Trie<number>();
    trie.insert("bad", 1);
    trie.insert("bad", 2);
    trie.insert("bunny", 1);
    expect(trie.size).toBe(2);
  });

  test("searchPrefix returns values without duplicates", () => {
    const trie = library();
    expect(trie.searchPrefix("bad").sort()).toEqual(["t1", "t2"]);
    expect(trie.searchPrefix("b").sort()).toEqual(["t1", "t2", "t3", "t4"]);
    expect(trie.searchPrefix("zzz")).toEqual([]);
    expect(trie.searchPrefix("b", 2)).toHaveLength(2);
  });

  test("accent-insensitive search", () => {
    const trie = library();
    expect(trie.searchPrefix("titi")).toEqual(["t1"]);
    expect(trie.searchPrefix("CANCIÓ")).toEqual(["t4"]);
  });

  test("search requires every query word to match", () => {
    const trie = library();
    expect(trie.search("bad bun").sort()).toEqual(["t1", "t2"]);
    expect(trie.search("bunny bonito")).toEqual(["t2"]);
    expect(trie.search("queen bunny")).toEqual([]);
    expect(trie.search("me bad", 1)).toHaveLength(1);
    expect(trie.search("   ")).toEqual([]);
  });

  test("complete suggests words in alphabetical order", () => {
    const trie = library();
    expect(trie.complete("b")).toEqual(["bad", "banderas", "bohemian", "bonito", "bunny"]);
    expect(trie.complete("bo", 1)).toEqual(["bohemian"]);
    expect(trie.complete("x")).toEqual([]);
  });

  test("remove deletes the value and prunes empty branches", () => {
    const trie = new Trie<string>();
    trie.insert("bunny", "a");
    trie.insert("bun", "b");
    expect(trie.remove("bunny", "a")).toBe(true);
    expect(trie.has("bunny")).toBe(false);
    expect(trie.has("bun")).toBe(true);
    expect(trie.complete("bu")).toEqual(["bun"]);
    expect(trie.size).toBe(1);
  });

  test("remove keeps the word while other values remain", () => {
    const trie = new Trie<string>();
    trie.insert("bad", "a");
    trie.insert("bad", "b");
    trie.remove("bad", "a");
    expect(trie.searchPrefix("bad")).toEqual(["b"]);
    expect(trie.size).toBe(1);
  });

  test("remove returns false when there is nothing to remove", () => {
    const trie = new Trie<string>();
    trie.insert("bad", "a");
    expect(trie.remove("bad", "zzz")).toBe(false);
    expect(trie.remove("ba", "a")).toBe(false);
    expect(trie.remove("nope", "a")).toBe(false);
    expect(trie.has("bad")).toBe(true);
  });

  test("removeText un-indexes a whole track", () => {
    const trie = library();
    trie.removeText("Me Porto Bonito · Bad Bunny", "t2");
    expect(trie.search("bad bunny")).toEqual(["t1"]);
    expect(trie.has("bonito")).toBe(false);
    expect(trie.has("me")).toBe(true);
  });

  test("clear", () => {
    const trie = library();
    trie.clear();
    expect(trie.size).toBe(0);
    expect(trie.searchPrefix("b")).toEqual([]);
  });
});
