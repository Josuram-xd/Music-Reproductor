import { tokenize, Trie } from "@/lib/ds/trie";
import type { LibraryFolder } from "./folders";
import type { LibraryTrack } from "./tracks";

/** Prefix indexes of the library: words of track title + artist, and of folder names. */
export interface LibraryIndex {
  tracks: Trie<string>;
  folders: Trie<string>;
}

export function buildLibraryIndex(tracks: LibraryTrack[], folders: LibraryFolder[]): LibraryIndex {
  const index: LibraryIndex = { tracks: new Trie(), folders: new Trie() };
  for (const track of tracks)
    index.tracks.insertText(`${track.title} ${track.artist ?? ""}`, track.id);
  for (const folder of folders) index.folders.insertText(folder.name, folder.id);
  return index;
}

/**
 * Autocomplete: completes the last word of the query with words of the
 * library ("bad bu" → "bad bunny"). Returns whole queries, without duplicates.
 */
export function suggest(index: LibraryIndex, query: string, limit = 6): string[] {
  const words = tokenize(query);
  // Only complete while the user is still typing a word.
  if (words.length === 0 || /\s$/.test(query)) return [];
  const head = words.slice(0, -1).join(" ");
  const last = words[words.length - 1]!;
  const completions = new Set([
    ...index.tracks.complete(last, limit),
    ...index.folders.complete(last, limit),
  ]);
  completions.delete(last);
  return [...completions]
    .sort()
    .slice(0, limit)
    .map((word) => (head ? `${head} ${word}` : word));
}
