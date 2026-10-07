interface CacheNode<K, V> {
  key: K;
  value: V;
  expiresAt: number;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
}

export interface LRUCacheOptions<K, V> {
  /** Maximum number of entries. */
  capacity: number;
  /** Default time to live in ms (e.g. signed URL lifetime). Infinity = never expires. */
  ttlMs?: number;
  /**
   * Called when a value leaves the cache: evicted, expired, deleted, cleared,
   * or replaced by a different value under the same key.
   */
  onEvict?: (key: K, value: V) => void;
  /** Clock, injectable for tests. */
  now?: () => number;
}

/**
 * Least-recently-used cache: `Map<key, node>` + doubly linked list ordered
 * from most to least recently used. `get`/`set`/`delete` are O(1).
 * Used for signed URLs and already loaded blobs (`onEvict` can revoke them).
 */
export class LRUCache<K, V> {
  private readonly map = new Map<K, CacheNode<K, V>>();
  /** Most recently used. */
  private head: CacheNode<K, V> | null = null;
  /** Least recently used. */
  private tail: CacheNode<K, V> | null = null;
  private readonly capacity: number;
  private readonly ttlMs: number;
  private readonly onEvict?: (key: K, value: V) => void;
  private readonly now: () => number;

  constructor({ capacity, ttlMs = Infinity, onEvict, now = Date.now }: LRUCacheOptions<K, V>) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`Invalid capacity: ${capacity}`);
    }
    if (!(ttlMs > 0)) throw new RangeError(`Invalid ttl: ${ttlMs}`);
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.onEvict = onEvict;
    this.now = now;
  }

  /** Number of stored entries (may include expired ones not yet purged). */
  get size(): number {
    return this.map.size;
  }

  /** Returns the value and marks it as most recently used. */
  get(key: K): V | undefined {
    const node = this.live(key);
    if (!node) return undefined;
    this.unlink(node);
    this.linkFront(node);
    return node.value;
  }

  /** Returns the value without changing its recency. */
  peek(key: K): V | undefined {
    return this.live(key)?.value;
  }

  has(key: K): boolean {
    return this.live(key) !== undefined;
  }

  /** Stores the value as most recently used; evicts the LRU entry if full. */
  set(key: K, value: V, ttlMs = this.ttlMs): void {
    const old = this.map.get(key);
    if (old) this.evict(old, old.value !== value);
    const node: CacheNode<K, V> = {
      key,
      value,
      expiresAt: this.now() + ttlMs,
      prev: null,
      next: null,
    };
    this.map.set(key, node);
    this.linkFront(node);
    if (this.map.size > this.capacity && this.tail) this.evict(this.tail);
  }

  delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.evict(node);
    return true;
  }

  /** Drops every expired entry. */
  prune(): void {
    for (const node of [...this.map.values()]) {
      if (this.isExpired(node)) this.evict(node);
    }
  }

  clear(): void {
    for (const node of [...this.map.values()]) this.evict(node);
  }

  /** Live keys from most to least recently used. */
  keys(): K[] {
    const keys: K[] = [];
    for (let n = this.head; n; n = n.next) {
      if (!this.isExpired(n)) keys.push(n.key);
    }
    return keys;
  }

  private live(key: K): CacheNode<K, V> | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    if (this.isExpired(node)) {
      this.evict(node);
      return undefined;
    }
    return node;
  }

  private isExpired(node: CacheNode<K, V>): boolean {
    return this.now() >= node.expiresAt;
  }

  private evict(node: CacheNode<K, V>, notify = true): void {
    this.unlink(node);
    this.map.delete(node.key);
    if (notify) this.onEvict?.(node.key, node.value);
  }

  private linkFront(node: CacheNode<K, V>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private unlink(node: CacheNode<K, V>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = node.next = null;
  }
}
