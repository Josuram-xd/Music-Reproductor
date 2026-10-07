import { NowPlayingCard } from "@/components/player/now-playing-card";
import { EmptyState } from "@/components/ui/empty-state";

/** "Now playing" + up next. The list itself arrives with the queue UI (E5). */
export function QueuePanel() {
  return (
    <section aria-labelledby="queue-title" className="flex flex-col gap-4 p-4">
      <h2 id="queue-title" className="font-display text-xl font-semibold">
        Cola
      </h2>
      <NowPlayingCard />
      <EmptyState title="La cola está vacía">
        Añade canciones desde tu biblioteca y aparecerán aquí 🐾
      </EmptyState>
    </section>
  );
}
