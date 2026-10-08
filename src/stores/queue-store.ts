import { create } from "zustand";
import { type Command, UndoManager } from "@/lib/ds/undo-manager";
import {
  clearDropPreference,
  getDropPreference,
  setDropPreference,
} from "@/lib/player/drop-preference";
import { DROP_MESSAGES, QUEUE_MESSAGES } from "@/lib/player/messages";
import {
  appendManyCommand,
  beforeCurrentId,
  type DropChoice,
  dropChoiceCommand,
  placeCommand,
  playNowCommand,
  removeCommand,
} from "@/lib/player/queue-commands";
import type { Track } from "@/lib/player/types";
import { getPlayer } from "./player-store";
import { toast } from "./toast-store";

/** A track dropped on top of the one playing, waiting for the user's choice. */
export interface PendingDrop {
  track: Track;
  /** The provisional move to position 0, reverted once the user chooses. */
  provisional: Command;
}

interface QueueState {
  pendingDrop: PendingDrop | null;
  /** "Don't ask again this session" choice, mirrored from sessionStorage. */
  dropPreference: DropChoice | null;
  canUndo: boolean;
  canRedo: boolean;
}

export const useQueueStore = create<QueueState>()(() => ({
  pendingDrop: null,
  dropPreference: null,
  canUndo: false,
  canRedo: false,
}));

/** Undo/redo stack of queue edits (moves, inserts, play now). */
const history = new UndoManager();

const UNDO_TOAST_MS = 5000;

/** Mirrors the undo/redo availability into the store (for the queue buttons). */
function syncHistory(): void {
  useQueueStore.setState({ canUndo: history.canUndo, canRedo: history.canRedo });
}

function run(command: Command): void {
  history.execute(command);
  syncHistory();
}

function undoLast(): Command | undefined {
  const command = history.undo();
  syncHistory();
  return command;
}

function forgetHistory(): void {
  history.clear();
  syncHistory();
}

function undoAction() {
  return { label: DROP_MESSAGES.undo, run: () => void undoLast() };
}

/** Queue edits from the queue panel and drags from the library. */
export const queue = {
  /** Reads the session preference (call once on the client). */
  syncPreference() {
    useQueueStore.setState({ dropPreference: getDropPreference() });
  },

  /** Replaces the queue with a list (clicking a library track) and forgets old edits. */
  playList(tracks: readonly Track[], startId: string) {
    forgetHistory();
    void getPlayer().setQueue(tracks, { startId });
  },

  /** Plays a track already in the queue (click on a queue row). */
  playQueued(id: string) {
    void getPlayer().jumpTo(id);
  },

  /** Drop at a position of "up next": right after `afterId` (`null` = front). */
  place(track: Track, afterId: string | null) {
    const engine = getPlayer();
    if (track.id === engine.getSnapshot().current?.id) return;
    const added = !engine.has(track.id);
    run(placeCommand(engine, track, afterId));
    if (added) toast(QUEUE_MESSAGES.added, { tone: "success", durationMs: 2500 });
  },

  /** "Reproducir" on a track outside the queue (e.g. a YouTube result). Undoable. */
  playNow(track: Track) {
    const engine = getPlayer();
    if (track.id === engine.getSnapshot().current?.id) return void engine.play();
    run(playNowCommand(engine, track));
  },

  /** "Añadir a la cola" button: to the end, unless it is already queued. */
  add(track: Track) {
    if (getPlayer().has(track.id)) {
      toast(QUEUE_MESSAGES.alreadyQueued, { durationMs: 2500 });
      return;
    }
    queue.append(track);
  },

  /** Appends a whole list (a playlist), skipping queued tracks. Returns how many were added. */
  addMany(tracks: readonly Track[]): number {
    const engine = getPlayer();
    const count = tracks.filter((track) => !engine.has(track.id)).length;
    if (count > 0) run(appendManyCommand(engine, tracks));
    return count;
  },

  /** Takes tracks out of the queue (not the one loaded). Undoable as one step. */
  remove(ids: readonly string[]) {
    const engine = getPlayer();
    const present = ids.filter((id) => engine.has(id) && id !== engine.getSnapshot().current?.id);
    if (present.length > 0) run(removeCommand(engine, present));
  },

  /** Drop at the end of the queue. */
  append(track: Track) {
    const items = getPlayer().getSnapshot().queue;
    const last = items.at(-1);
    if (last?.id === track.id) return;
    queue.place(track, last?.id ?? null);
  },

  /**
   * Drop on top of the track playing (position 0). Applies the move right
   * away and asks what to do, unless a choice was saved for this session.
   */
  dropOnCurrent(track: Track) {
    const engine = getPlayer();
    const current = engine.getSnapshot().current;
    if (track.id === current?.id) return;
    // Nothing is cut: just play it.
    if (!current) return run(playNowCommand(engine, track));

    const preference = getDropPreference();
    if (preference) {
      run(dropChoiceCommand(engine, track, preference));
      toast(DROP_MESSAGES.applied[preference](track.title), {
        durationMs: UNDO_TOAST_MS,
        action: undoAction(),
      });
      return;
    }

    // Replace a drop still waiting for an answer: that one counts as a mistake.
    queue.resolveDrop("revert");
    const provisional = placeCommand(engine, track, beforeCurrentId(engine));
    run(provisional);
    useQueueStore.setState({ pendingDrop: { track, provisional } });
  },

  /** Answer to the drop dialog. `remember` saves it for the rest of the session. */
  resolveDrop(choice: DropChoice | "revert", { remember = false } = {}) {
    const pending = useQueueStore.getState().pendingDrop;
    if (!pending) return;
    useQueueStore.setState({ pendingDrop: null });

    // Revert the provisional move only if nothing was done on top of it.
    if (history.peekUndo() === pending.provisional) undoLast();
    if (choice === "revert") return;

    run(dropChoiceCommand(getPlayer(), pending.track, choice));
    if (remember) {
      setDropPreference(choice);
      useQueueStore.setState({ dropPreference: choice });
      toast(DROP_MESSAGES.remembered, { durationMs: UNDO_TOAST_MS });
    }
  },

  /** Asks again on the next drop (from Ajustes). */
  resetDropPreference() {
    clearDropPreference();
    useQueueStore.setState({ dropPreference: null });
  },

  /** Ctrl+Z: undoes the last queue edit (or answers "Fue un error" to an open drop dialog). */
  undo() {
    if (useQueueStore.getState().pendingDrop) return queue.resolveDrop("revert");
    const command = undoLast();
    toast(command ? QUEUE_MESSAGES.undone(command.label) : QUEUE_MESSAGES.nothingToUndo, {
      durationMs: 2500,
    });
  },

  /** Ctrl+Shift+Z / Ctrl+Y: redoes the last undone edit. */
  redo() {
    if (useQueueStore.getState().pendingDrop) return;
    const command = history.redo();
    syncHistory();
    toast(command ? QUEUE_MESSAGES.redone(command.label) : QUEUE_MESSAGES.nothingToRedo, {
      durationMs: 2500,
    });
  },

  /**
   * Puts back the queue saved in `queue_state` (paused, at the saved second),
   * unless the user already started something else meanwhile.
   */
  async restore(tracks: readonly Track[], currentId: string | null, positionS: number) {
    const engine = getPlayer();
    if (tracks.length === 0 || engine.getSnapshot().queue.length > 0) return false;
    forgetHistory();
    await engine.setQueue(tracks, { startId: currentId ?? undefined, autoplay: false });
    if (positionS > 0) engine.seek(positionS);
    return true;
  },
};
