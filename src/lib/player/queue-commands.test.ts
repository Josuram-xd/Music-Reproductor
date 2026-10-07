import { describe, expect, test } from "vitest";
import { UndoManager } from "@/lib/ds/undo-manager";
import { FakeSource } from "./fake-source.test-utils";
import { PlayerEngine } from "./player-engine";
import {
  beforeCurrentId,
  dropChoiceCommand,
  insertCommand,
  moveCommand,
  placeCommand,
  playNextCommand,
  playNowCommand,
} from "./queue-commands";
import type { Track } from "./types";

const track = (id: string): Track => ({ id, source: "audio", title: `Song ${id}`, durationS: 100 });

async function setup(ids = ["a", "b", "c", "d"], startId?: string) {
  const audio = new FakeSource("audio");
  const engine = new PlayerEngine({ sources: [audio] });
  await engine.setQueue(ids.map(track), { startId });
  const history = new UndoManager();
  const order = () => engine.getSnapshot().queue.map((t) => t.id);
  const current = () => engine.getSnapshot().current?.id;
  return { engine, audio, history, order, current };
}

describe("queue commands", () => {
  test("move and undo restore the original order", async () => {
    const { engine, history, order } = await setup();
    history.execute(moveCommand(engine, "d", "a"));
    expect(order()).toEqual(["a", "d", "b", "c"]);
    history.undo();
    expect(order()).toEqual(["a", "b", "c", "d"]);
    history.redo();
    expect(order()).toEqual(["a", "d", "b", "c"]);
  });

  test("moving the first track and undoing puts it back at the front", async () => {
    const { engine, history, order } = await setup(["a", "b", "c"], "c");
    history.execute(moveCommand(engine, "a", "b"));
    expect(order()).toEqual(["b", "a", "c"]);
    history.undo();
    expect(order()).toEqual(["a", "b", "c"]);
  });

  test("insert and undo remove the new track", async () => {
    const { engine, history, order } = await setup();
    history.execute(insertCommand(engine, track("x"), "b"));
    expect(order()).toEqual(["a", "b", "x", "c", "d"]);
    history.undo();
    expect(order()).toEqual(["a", "b", "c", "d"]);
  });

  test("place moves queued tracks and inserts new ones", async () => {
    const { engine, order } = await setup();
    placeCommand(engine, track("c"), null).execute();
    placeCommand(engine, track("x"), "a").execute();
    expect(order()).toEqual(["c", "a", "x", "b", "d"]);
  });

  test("beforeCurrentId is the anchor for position 0", async () => {
    const { engine } = await setup(["a", "b", "c"], "b");
    expect(beforeCurrentId(engine)).toBe("a");
    await engine.jumpTo("a");
    expect(beforeCurrentId(engine)).toBeNull();
  });

  test("play next puts the track right after the current one", async () => {
    const { engine, history, order, current } = await setup(["a", "b", "c", "d"], "b");
    history.execute(playNextCommand(engine, track("d")));
    expect(order()).toEqual(["a", "b", "d", "c"]);
    expect(current()).toBe("b");
  });

  test("play now cuts the current track, which comes back right after", async () => {
    const { engine, history, order, current } = await setup(["a", "b", "c", "d"], "b");
    history.execute(playNowCommand(engine, track("d")));
    await Promise.resolve();
    expect(order()).toEqual(["a", "d", "b", "c"]);
    expect(current()).toBe("d");
    await engine.next();
    expect(current()).toBe("b");
  });

  test("undoing play now resumes the cut track where it was", async () => {
    const { engine, audio, history, order, current } = await setup(["a", "b", "c"], "b");
    audio.advanceTo(37);
    history.execute(playNowCommand(engine, track("x")));
    expect(current()).toBe("x");
    history.undo();
    await new Promise((resolve) => setTimeout(resolve));
    expect(current()).toBe("b");
    expect(order()).toEqual(["a", "b", "c"]);
    expect(engine.getSnapshot()).toMatchObject({ time: 37, state: "playing" });
  });

  test("play now with an empty player just plays the track", async () => {
    const { engine, history, order, current } = await setup([]);
    history.execute(playNowCommand(engine, track("x")));
    expect(order()).toEqual(["x"]);
    expect(current()).toBe("x");
  });

  test("dropChoiceCommand maps each choice", async () => {
    const { engine, current, order } = await setup(["a", "b", "c"]);
    dropChoiceCommand(engine, track("c"), "playNext").execute();
    expect(order()).toEqual(["a", "c", "b"]);
    dropChoiceCommand(engine, track("b"), "playNow").execute();
    expect(current()).toBe("b");
  });
});
