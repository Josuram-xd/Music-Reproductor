interface TrieNode<T> {
  children: Map<string, TrieNode<T>>;
  /** Values stored under the word that ends at this node. */
  values: Set<T>;
}

const createNode = <T>(): TrieNode<T> => ({ children: new Map(), values: new Set() });

/** Lowercases and strips accents, so "Canción" matches "cancion". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Splits text into normalized words (letters and digits). */
export function tokenize(text: string): string[] {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Prefix tree for library autocomplete. Each word maps to a set of values
 * (e.g. track ids). Lookups are O(length of the prefix) plus the results.
 */
export class Trie<T> {
  private readonly root: TrieNode<T> = createNode();
  private wordCount = 0;

  /** Number of distinct words stored. */
  get size(): number {
    return this.wordCount;
  }

  /** Stores `value` under `word` (normalized). */
  insert(word: string, value: T): void {
    const key = normalize(word);
    if (!key) return;
    let node = this.root;
    for (const char of key) {
      let next = node.children.get(char);
      if (!next) {
        next = createNode();
        node.children.set(char, next);
      }
      node = next;
    }
    if (node.values.size === 0) this.wordCount++;
    node.values.add(value);
  }

  /** Indexes every word of `text` (e.g. "title artist") under `value`. */
  insertText(text: string, value: T): void {
    for (const word of tokenize(text)) this.insert(word, value);
  }

  /** Removes `value` from `word` and prunes empty branches. Returns whether it was there. */
  remove(word: string, value: T): boolean {
    const key = normalize(word);
    const path: TrieNode<T>[] = [this.root];
    for (const char of key) {
      const next = path[path.length - 1]!.children.get(char);
      if (!next) return false;
      path.push(next);
    }
    const end = path[path.length - 1]!;
    if (!end.values.delete(value)) return false;
    if (end.values.size === 0) this.wordCount--;
    const chars = [...key];
    for (let i = chars.length; i > 0; i--) {
      const node = path[i]!;
      if (node.values.size > 0 || node.children.size > 0) break;
      path[i - 1]!.children.delete(chars[i - 1]!);
    }
    return true;
  }

  /** Removes `value` from every word of `text`. */
  removeText(text: string, value: T): void {
    for (const word of tokenize(text)) this.remove(word, value);
  }

  /** Whether `word` was inserted as a whole word. */
  has(word: string): boolean {
    return (this.find(normalize(word))?.values.size ?? 0) > 0;
  }

  /** Values of every word starting with `prefix`, without duplicates. */
  searchPrefix(prefix: string, limit = Infinity): T[] {
    const start = this.find(normalize(prefix));
    const results = new Set<T>();
    if (!start) return [];
    for (const [, node] of this.walk(start, "")) {
      for (const value of node.values) {
        results.add(value);
        if (results.size >= limit) return [...results];
      }
    }
    return [...results];
  }

  /**
   * Multi-word search: every word of the query must prefix-match some word
   * of the value ("bad bun" finds "Bad Bunny"). Empty query = no results.
   */
  search(query: string, limit = Infinity): T[] {
    const words = tokenize(query);
    if (words.length === 0) return [];
    let matches = new Set(this.searchPrefix(words[0]!));
    for (const word of words.slice(1)) {
      const next = new Set(this.searchPrefix(word));
      matches = new Set([...matches].filter((v) => next.has(v)));
      if (matches.size === 0) break;
    }
    return [...matches].slice(0, limit);
  }

  /** Stored words that start with `prefix`, in alphabetical order (for suggestions). */
  complete(prefix: string, limit = Infinity): string[] {
    const key = normalize(prefix);
    const start = this.find(key);
    if (!start) return [];
    const words: string[] = [];
    for (const [suffix, node] of this.walk(start, "", true)) {
      if (node.values.size === 0) continue;
      words.push(key + suffix);
      if (words.length >= limit) break;
    }
    return words;
  }

  clear(): void {
    this.root.children.clear();
    this.root.values.clear();
    this.wordCount = 0;
  }

  private find(key: string): TrieNode<T> | undefined {
    let node: TrieNode<T> | undefined = this.root;
    for (const char of key) {
      node = node.children.get(char);
      if (!node) return undefined;
    }
    return node;
  }

  /** Depth-first walk yielding `[suffix, node]`; `sorted` visits children alphabetically. */
  private *walk(
    node: TrieNode<T>,
    suffix: string,
    sorted = false,
  ): IterableIterator<[string, TrieNode<T>]> {
    yield [suffix, node];
    const entries = [...node.children];
    if (sorted) entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [char, child] of entries) yield* this.walk(child, suffix + char, sorted);
  }
}
