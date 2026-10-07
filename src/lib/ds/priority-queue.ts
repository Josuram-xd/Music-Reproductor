/** Returns > 0 if `a` has higher priority than `b`, < 0 if lower, 0 if equal. */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Max-heap priority queue stored in an array: the highest-priority item is
 * at index 0 and the children of `i` are at `2i + 1` and `2i + 2`.
 * `push`/`pop` are O(log n), `peek` is O(1), building from a list is O(n).
 */
export class PriorityQueue<T> {
  private readonly heap: T[];

  constructor(
    private readonly compare: Comparator<T>,
    items: Iterable<T> = [],
  ) {
    this.heap = [...items];
    for (let i = (this.heap.length >> 1) - 1; i >= 0; i--) this.siftDown(i);
  }

  get size(): number {
    return this.heap.length;
  }

  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /** Highest-priority item without removing it. */
  peek(): T | undefined {
    return this.heap[0];
  }

  push(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  /** Removes and returns the highest-priority item. */
  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** Pops up to `count` items, highest priority first. */
  take(count: number): T[] {
    const items: T[] = [];
    while (items.length < count && !this.isEmpty) items.push(this.pop()!);
    return items;
  }

  clear(): void {
    this.heap.length = 0;
  }

  /** Copy of the items in heap order (not sorted). */
  toArray(): T[] {
    return [...this.heap];
  }

  private siftUp(i: number): void {
    const heap = this.heap;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(heap[i]!, heap[parent]!) <= 0) return;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(i: number): void {
    const heap = this.heap;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let largest = i;
      if (left < heap.length && this.compare(heap[left]!, heap[largest]!) > 0) largest = left;
      if (right < heap.length && this.compare(heap[right]!, heap[largest]!) > 0) largest = right;
      if (largest === i) return;
      this.swap(i, largest);
      i = largest;
    }
  }

  private swap(a: number, b: number): void {
    const heap = this.heap;
    [heap[a], heap[b]] = [heap[b]!, heap[a]!];
  }
}

/** Builds a comparator that ranks by a numeric score (higher first). */
export function byScore<T>(score: (item: T) => number): Comparator<T> {
  return (a, b) => score(a) - score(b);
}

/** Top `n` items by priority, highest first (e.g. most played tracks). */
export function topN<T>(items: Iterable<T>, n: number, compare: Comparator<T>): T[] {
  return new PriorityQueue(compare, items).take(n);
}
