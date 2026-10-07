export type Id = string;

interface ListNode<T> {
  readonly id: Id;
  value: T;
  prev: ListNode<T> | null;
  next: ListNode<T> | null;
}

/**
 * Lista doblemente enlazada con índice `Map<id, nodo>`.
 * Acceso, inserción, borrado y movimiento por id en O(1)
 * (salvo `moveTo`/`at`/`indexOf`, que recorren la lista: O(n)).
 * Los ids deben ser únicos.
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

  /** Siguiente valor tras `id`, o `undefined` si es el último. */
  nextOf(id: Id): T | undefined {
    return this.node(id).next?.value;
  }

  /** Valor anterior a `id`, o `undefined` si es el primero. */
  prevOf(id: Id): T | undefined {
    return this.node(id).prev?.value;
  }

  append(value: T): void {
    this.linkAfter(this.createNode(value), this.tail);
  }

  prepend(value: T): void {
    this.linkAfter(this.createNode(value), null);
  }

  /** Inserta `value` justo después del nodo `refId`. */
  insertAfter(refId: Id, value: T): void {
    const ref = this.node(refId);
    this.linkAfter(this.createNode(value), ref);
  }

  /** Inserta `value` justo antes del nodo `refId`. */
  insertBefore(refId: Id, value: T): void {
    const ref = this.node(refId);
    this.linkAfter(this.createNode(value), ref.prev);
  }

  /** Quita el nodo y devuelve su valor, o `undefined` si no existe. */
  remove(id: Id): T | undefined {
    const node = this.index.get(id);
    if (!node) return undefined;
    this.unlink(node);
    this.index.delete(id);
    return node.value;
  }

  /** Mueve `id` justo después de `refId` (`null` = al principio). O(1). */
  moveAfter(id: Id, refId: Id | null): void {
    const node = this.node(id);
    const ref = refId === null ? null : this.node(refId);
    if (ref === node) throw new Error(`No se puede mover "${id}" después de sí mismo`);
    if (node.prev === ref) return;
    this.unlink(node);
    this.linkAfter(node, ref);
  }

  /** Mueve `id` justo antes de `refId`. O(1). */
  moveBefore(id: Id, refId: Id): void {
    const node = this.node(id);
    const ref = this.node(refId);
    if (ref === node) throw new Error(`No se puede mover "${id}" antes de sí mismo`);
    this.unlink(node);
    this.linkAfter(node, ref.prev);
  }

  /** Mueve `id` para que quede en la posición `toIndex` (0-based). O(n). */
  moveTo(id: Id, toIndex: number): void {
    const node = this.node(id);
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= this.size) {
      throw new RangeError(`Índice fuera de rango: ${toIndex}`);
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

  /** Posición de `id`, o -1 si no está. O(n). */
  indexOf(id: Id): number {
    let i = 0;
    for (let n = this.head; n; n = n.next, i++) {
      if (n.id === id) return i;
    }
    return -1;
  }

  /** Valor en la posición `i`, o `undefined`. O(n). */
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
    if (!node) throw new Error(`No existe el id "${id}" en la lista`);
    return node;
  }

  private createNode(value: T): ListNode<T> {
    const id = this.getId(value);
    if (this.index.has(id)) throw new Error(`El id "${id}" ya está en la lista`);
    const node: ListNode<T> = { id, value, prev: null, next: null };
    this.index.set(id, node);
    return node;
  }

  /** Enlaza `node` (ya desenlazado) después de `ref`; `ref = null` lo pone al principio. */
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
