import { SaveQueueButton } from "@/components/playlists/save-queue-button";
import { QueueBoard } from "@/components/queue/queue-board";
import { QueueHistoryButtons } from "@/components/queue/queue-history-buttons";

/** "Now playing" + up next, sortable, accepting drops from the library. */
export function QueuePanel() {
  return (
    <section aria-labelledby="queue-title" className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="queue-title" className="font-display text-xl font-semibold">
          Cola
        </h2>
        <div className="flex items-center">
          <QueueHistoryButtons />
          <SaveQueueButton />
        </div>
      </div>
      <QueueBoard />
    </section>
  );
}
