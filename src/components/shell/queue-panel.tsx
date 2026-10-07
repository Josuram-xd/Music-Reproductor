import { EmptyState } from "@/components/ui/empty-state";

/** "Now playing" + up next. Placeholder until the player (E3) and queue (E5) exist. */
export function QueuePanel() {
  return (
    <section aria-labelledby="queue-title" className="flex flex-col gap-4 p-4">
      <h2 id="queue-title" className="font-display text-xl font-semibold">
        Cola
      </h2>
      <div className="rounded-3xl bg-surface-2/60 p-4">
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">Ahora suena</p>
        <p className="mt-1 text-sm text-muted">Nada por ahora, nya~</p>
      </div>
      <EmptyState title="La cola está vacía">
        Añade canciones desde tu biblioteca y aparecerán aquí 🐾
      </EmptyState>
    </section>
  );
}
