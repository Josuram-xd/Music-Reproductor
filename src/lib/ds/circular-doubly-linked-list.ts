import { DoublyLinkedList, type Id } from "./doubly-linked-list";

/**
 * Circular variant for repeat-all mode: the first item follows the last
 * and the last precedes the first. Inherits the index and O(1) operations.
 */
export class CircularDoublyLinkedList<T> extends DoublyLinkedList<T> {
  override nextOf(id: Id): T | undefined {
    return (this.node(id).next ?? this.head)?.value;
  }

  override prevOf(id: Id): T | undefined {
    return (this.node(id).prev ?? this.tail)?.value;
  }

  /** Yields `count` values starting at `startId` (inclusive), wrapping around. */
  *cycle(startId: Id, count: number): IterableIterator<T> {
    let node = this.node(startId);
    for (let i = 0; i < count; i++) {
      yield node.value;
      const next = node.next ?? this.head;
      if (!next) return;
      node = next;
    }
  }
}
