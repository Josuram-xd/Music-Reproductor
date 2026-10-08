/**
 * Fractional ranks (lexorank-style) for ordered lists stored in a database:
 * each item has a string key and the list is sorted by plain byte order.
 * To move or insert an item only its own key changes — a new key strictly
 * between its new neighbours — so reordering never rewrites the other rows.
 *
 * Keys are base-36 fractions ("i" ≈ 0.5) written with `0-9a-z`. They never
 * end in "0", which guarantees there is always room between two keys.
 * Repeated inserts at the same spot make keys longer; `rebalanceRanks`
 * hands out short, evenly spaced keys again.
 */

export const RANK_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = RANK_DIGITS.length;
const ZERO = RANK_DIGITS[0]!;

/** Keys longer than this should be rebalanced (they still work, just grow). */
export const MAX_RANK_LENGTH = 32;

const VALID = /^[0-9a-z]*[1-9a-z]$/;

export function isValidRank(rank: string): boolean {
  return VALID.test(rank);
}

function digit(char: string): number {
  return RANK_DIGITS.indexOf(char);
}

/** Midpoint of the fractions `a` ("" = 0) and `b` (null = 1). Requires a < b. */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    // Shared prefix: the midpoint starts with it too.
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? digit(a[0]!) : 0;
  const digitB = b !== null ? digit(b[0]!) : BASE;
  if (digitB - digitA > 1) return RANK_DIGITS[Math.round((digitA + digitB) / 2)]!;
  // Consecutive first digits: "b" alone is already above `a` if `b` has more digits…
  if (b !== null && b.length > 1) return b.slice(0, 1);
  // …otherwise keep a's first digit and look for room after it.
  return RANK_DIGITS[digitA]! + midpoint(a.slice(1), null);
}

function check(rank: string | null, name: string): void {
  if (rank !== null && !isValidRank(rank)) throw new Error(`Invalid rank ${name}: "${rank}"`);
}

/**
 * A key strictly between `before` and `after` (`null` = the start / the end
 * of the list). Throws if they are invalid or not in order.
 */
export function rankBetween(before: string | null, after: string | null): string {
  check(before, "before");
  check(after, "after");
  if (before !== null && after !== null && before >= after) {
    throw new Error(`Ranks out of order: "${before}" >= "${after}"`);
  }
  return midpoint(before ?? "", after);
}

/**
 * `count` increasing keys strictly between `before` and `after`. Splits the
 * gap in halves recursively, so keys grow logarithmically, not linearly.
 */
export function ranksBetween(before: string | null, after: string | null, count: number): string[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`Invalid count: ${count}`);
  if (count === 0) return [];
  const middle = rankBetween(before, after);
  const left = Math.floor((count - 1) / 2);
  return [
    ...ranksBetween(before, middle, left),
    middle,
    ...ranksBetween(middle, after, count - 1 - left),
  ];
}

/** `count` short, evenly spaced keys (all the same length before trimming). */
export function rebalanceRanks(count: number): string[] {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`Invalid count: ${count}`);
  // One extra digit leaves room for future inserts between neighbours.
  let length = 1;
  while (BASE ** length < (count + 1) * BASE) length++;
  const slots = BASE ** length;
  const step = slots / (count + 1);
  return Array.from({ length: count }, (_, i) => {
    const value = Math.round(step * (i + 1));
    return value.toString(BASE).padStart(length, ZERO).replace(/0+$/, "");
  });
}
