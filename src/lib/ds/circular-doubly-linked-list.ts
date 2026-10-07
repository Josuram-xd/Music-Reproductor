import { DoublyLinkedList, type Id } from "./doubly-linked-list";

/**
 * Variante circular para el modo repetir-todo: tras el último viene el
 * primero y antes del primero, el último. Hereda índice y operaciones O(1).
 */
export class CircularDoublyLinkedList<T> extends DoublyLinkedList<T> {
  override nextOf(id: Id): T | undefined {
    return (this.node(id).next ?? this.head)?.value;
  }

  override prevOf(id: Id): T | undefined {
    return (this.node(id).prev ?? this.tail)?.value;
  }

  /** Recorre `count` valores a partir de `startId` (incluido), dando vueltas. */
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
