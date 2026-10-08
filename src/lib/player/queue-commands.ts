import type { Command } from "@/lib/ds/undo-manager";
import type { PlayerEngine } from "./player-engine";
import type { Track } from "./types";

/** What to do with a track dropped on top of the one playing (docs/ARCHITECTURE.md). */
export type DropChoice = "playNow" | "playNext";

/** Moves a queued track right after `afterId` (`null` = front). Undo puts it back. */
export function moveCommand(engine: PlayerEngine, id: string, afterId: string | null): Command {
  let previous: string | null = null;
  return {
    label: "move",
    execute() {
      previous = engine.previousIdOf(id);
      engine.move(id, afterId);
    },
    undo() {
      engine.move(id, previous);
    },
  };
}

/** Adds a track right after `afterId` (`null` = front). Undo removes it. */
export function insertCommand(engine: PlayerEngine, track: Track, afterId: string | null): Command {
  return {
    label: "insert",
    execute() {
      engine.insert(track, afterId);
    },
    undo() {
      engine.remove(track.id);
    },
  };
}

/**
 * Appends every track that is not queued yet, as one undoable step
 * (e.g. "Añadir la playlist a la cola"). Undo removes exactly those.
 */
export function appendManyCommand(engine: PlayerEngine, tracks: readonly Track[]): Command {
  let added: string[] = [];
  return {
    label: "insertMany",
    execute() {
      added = [];
      for (const track of tracks) {
        const last = engine.getSnapshot().queue.at(-1)?.id ?? null;
        if (engine.insert(track, last)) added.push(track.id);
      }
    },
    undo() {
      for (const id of added) engine.remove(id);
    },
  };
}

/**
 * Removes queued tracks (not the one loaded) as one undoable step;
 * undo puts each back after the track that preceded it.
 */
export function removeCommand(engine: PlayerEngine, ids: readonly string[]): Command {
  let removed: { track: Track; afterId: string | null }[] = [];
  return {
    label: "remove",
    execute() {
      removed = [];
      for (const id of ids) {
        const track = engine.getSnapshot().queue.find((t) => t.id === id);
        const afterId = engine.previousIdOf(id);
        if (track && engine.remove(id)) removed.push({ track, afterId });
      }
    },
    undo() {
      for (const { track, afterId } of [...removed].reverse()) {
        if (!engine.insert(track, afterId)) engine.insert(track, null);
      }
    },
  };
}

/** Puts `track` right after `afterId`: a move if it is already queued, an insert otherwise. */
export function placeCommand(engine: PlayerEngine, track: Track, afterId: string | null): Command {
  return engine.has(track.id)
    ? moveCommand(engine, track.id, afterId)
    : insertCommand(engine, track, afterId);
}

/** Id after which a track must go to end up right before the current one (position 0). */
export function beforeCurrentId(engine: PlayerEngine): string | null {
  const current = engine.getSnapshot().current;
  return current ? engine.previousIdOf(current.id) : null;
}

/**
 * "Play now": places `track` right before the current one and plays it,
 * so the cut track comes back right after. Undo resumes the cut track
 * where it was and restores the queue.
 */
export function playNowCommand(engine: PlayerEngine, track: Track): Command {
  let place: Command | null = null;
  let resume: { id: string; time: number; playing: boolean } | null = null;
  return {
    label: "playNow",
    execute() {
      const snapshot = engine.getSnapshot();
      resume = snapshot.current
        ? { id: snapshot.current.id, time: snapshot.time, playing: engine.isPlaying }
        : null;
      place = placeCommand(engine, track, beforeCurrentId(engine));
      place.execute();
      void engine.jumpTo(track.id);
    },
    undo() {
      // Reload the cut track first: the one playing cannot be removed from the queue.
      if (resume) {
        void engine.jumpTo(resume.id, {
          startAt: resume.time,
          autoplay: resume.playing,
          remember: false,
        });
      }
      place?.undo();
    },
  };
}

/** "Play next": puts `track` right after the current one. */
export function playNextCommand(engine: PlayerEngine, track: Track): Command {
  const current = engine.getSnapshot().current;
  return placeCommand(engine, track, current?.id ?? null);
}

export function dropChoiceCommand(engine: PlayerEngine, track: Track, choice: DropChoice) {
  return choice === "playNow" ? playNowCommand(engine, track) : playNextCommand(engine, track);
}
