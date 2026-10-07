type Listener<T> = (payload: T) => void;

/** Minimal typed event emitter. A throwing listener does not stop the others. */
export class Emitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<E extends keyof Events>(event: E, listener: Listener<Events[E]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => set.delete(listener as Listener<never>);
  }

  emit<E extends keyof Events>(event: E, payload: Events[E]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      try {
        (listener as Listener<Events[E]>)(payload);
      } catch (error) {
        console.error(`Listener for "${String(event)}" failed`, error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
