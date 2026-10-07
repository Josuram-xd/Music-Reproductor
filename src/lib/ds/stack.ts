/**
 * Pila LIFO. Con `capacity` se descarta el elemento más antiguo al
 * llenarse (útil para historial y undo acotados).
 */
export class Stack<T> {
  private items: T[] = [];

  constructor(private readonly capacity = Infinity) {
    if (!(capacity > 0)) throw new RangeError(`Capacidad inválida: ${capacity}`);
  }

  get size(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(value: T): void {
    this.items.push(value);
    if (this.items.length > this.capacity) this.items.shift();
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  clear(): void {
    this.items = [];
  }

  /** Copia de fondo a cima. */
  toArray(): T[] {
    return [...this.items];
  }
}
