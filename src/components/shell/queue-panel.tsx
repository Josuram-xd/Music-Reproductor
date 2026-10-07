import { QueueBoard } from "@/components/queue/queue-board";

/** "Now playing" + up next, sortable, accepting drops from the library. */
export function QueuePanel() {
  return (
    <section aria-labelledby="queue-title" className="flex flex-col gap-4 p-4">
      <h2 id="queue-title" className="font-display text-xl font-semibold">
        Cola
      </h2>
      <QueueBoard />
    </section>
  );
}
