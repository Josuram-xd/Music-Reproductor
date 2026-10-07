export type Id = string;

interface ListNode<T> {
  readonly id: Id;
  value: T;
  prev: ListNode<T> | null;
  next: ListNode<T> | null;
}

/**
 * Doubly linked list with a `Map<id, node>` index.
 * Lookup, insertion, removal and moves by id are O(1)
 * (except `moveTo`/`at`/`indexOf`, which walk the list: O(n)).
 * Ids must be unique.
 */
export class DoublyLinkedList<T> {
  protected head: ListNode<T> | null = null;
  protected tail: ListNode<T> | null = null;
  private readonly index = new Map<Id, ListNode<T>>();

  constructor(
    private readonly getId: (value: T) => Id,
    values: Iterable<T> = [],
  ) {
    for (const value of values) this.append(value);
  }

  get size(): number {
    return this.index.size;
  }

  get isEmpty(): boolean {
    return this.index.size === 0;
  }

  get first(): T | undefined {
    return this.head?.value;
  }

  get last(): T | undefined {
    return this.tail?.value;
  }

  has(id: Id): boolean {
    return this.index.has(id);
  }

  get(id: Id): T | undefined {
    return this.index.get(id)?.value;
  }

  /** Value after `id`, or `undefined` if it is the last one. */
  nextOf(id: Id): T | undefined {
    return this.node(id).next?.value;
  }

  /** Value before `id`, or `undefined` if it is the first one. */
  prevOf(id: Id): T | undefined {
    return this.node(id).prev?.value;
  }

  append(value: T): void {
    this.linkAfter(this.createNode(value), this.tail);
  }

  prepend(value: T): void {
    this.linkAfter(this.createNode(value), null);
  }

  /** Inserts `value` right after the `refId` node. */
  insertAfter(refId: Id, value: T): void {
    const ref = this.node(refId);
    this.linkAfter(this.createNode(value), ref);
  }

  /** Inserts `value` right before the `refId` node. */
  insertBefore(refId: Id, value: T): void {
    const ref = this.node(refId);
    this.linkAfter(this.createNode(value), ref.prev);
  }

  /** Removes the node and returns its value, or `undefined` if missing. */
  remove(id: Id): T | undefined {
    const node = this.index.get(id);
    if (!node) return undefined;
    this.unlink(node);
    this.index.delete(id);
    return node.value;
  }

  /** Moves `id` right after `refId` (`null` = to the front). O(1). */
  moveAfter(id: Id, refId: Id | null): void {
    const node = this.node(id);
    const ref = refId === null ? null : this.node(refId);
    if (ref === node) throw new Error(`Cannot move "${id}" after itself`);
    if (node.prev === ref) return;
    this.unlink(node);
    this.linkAfter(node, ref);
  }

  /** Moves `id` right before `refId`. O(1). */
  moveBefore(id: Id, refId: Id): void {
    const node = this.node(id);
    const ref = this.node(refId);
    if (ref === node) throw new Error(`Cannot move "${id}" before itself`);
    this.unlink(node);
    this.linkAfter(node, ref.prev);
  }

  /** Moves `id` so it ends up at position `toIndex` (0-based). O(n). */
  moveTo(id: Id, toIndex: number): void {
    const node = this.node(id);
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= this.size) {
      throw new RangeError(`Index out of range: ${toIndex}`);
    }
    this.unlink(node);
    let ref: ListNode<T> | null = null;
    let current = this.head;
    for (let i = 0; i < toIndex && current; i++) {
      ref = current;
      current = current.next;
    }
    this.linkAfter(node, ref);
  }

  /** Position of `id`, or -1 if missing. O(n). */
  indexOf(id: Id): number {
    let i = 0;
    for (let n = this.head; n; n = n.next, i++) {
      if (n.id === id) return i;
    }
    return -1;
  }

  /** Value at position `i`, or `undefined`. O(n). */
  at(i: number): T | undefined {
    let n = this.head;
    for (let k = 0; k < i && n; k++) n = n.next;
    return i >= 0 ? n?.value : undefined;
  }

  clear(): void {
    this.head = this.tail = null;
    this.index.clear();
  }

  toArray(): T[] {
    return [...this];
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (let n = this.head; n; n = n.next) yield n.value;
  }

  protected node(id: Id): ListNode<T> {
    const node = this.index.get(id);
    if (!node) throw new Error(`Id "${id}" is not in the list`);
    return node;
  }

  private createNode(value: T): ListNode<T> {
    const id = this.getId(value);
    if (this.index.has(id)) throw new Error(`Id "${id}" is already in the list`);
    const node: ListNode<T> = { id, value, prev: null, next: null };
    this.index.set(id, node);
    return node;
  }

  /** Links an unlinked `node` after `ref`; `ref = null` puts it at the front. */
  private linkAfter(node: ListNode<T>, ref: ListNode<T> | null): void {
    const next = ref ? ref.next : this.head;
    node.prev = ref;
    node.next = next;
    if (ref) ref.next = node;
    else this.head = node;
    if (next) next.prev = node;
    else this.tail = node;
  }

  private unlink(node: ListNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = node.next = null;
  }
}
