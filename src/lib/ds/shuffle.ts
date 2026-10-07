/** Random number generator returning floats in [0, 1). */
export type Rng = () => number;

/** Hashes a string into a 32-bit seed (FNV-1a). */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Seeded PRNG (mulberry32). The same seed always yields the same sequence,
 * so a shuffled queue can be rebuilt from its seed (e.g. after a reload).
 */
export function createRng(seed: number | string): Rng {
  let state = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random seed for a new shuffle; store it to reproduce the order later. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** Fisher–Yates shuffle in place. O(n), every permutation equally likely. */
export function shuffleInPlace<T>(items: T[], rng: Rng = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** Returns a shuffled copy; the same seed always gives the same order. */
export function shuffle<T>(items: readonly T[], seed: number | string): T[] {
  return shuffleInPlace([...items], createRng(seed));
}

/**
 * Shuffles a copy but keeps `pinned` (e.g. the track now playing) first.
 * If `pinned` is not in `items`, behaves like `shuffle`.
 */
export function shuffleKeepingFirst<T>(items: readonly T[], pinned: T, seed: number | string): T[] {
  const index = items.indexOf(pinned);
  if (index === -1) return shuffle(items, seed);
  const rest = [...items.slice(0, index), ...items.slice(index + 1)];
  return [pinned, ...shuffleInPlace(rest, createRng(seed))];
}
