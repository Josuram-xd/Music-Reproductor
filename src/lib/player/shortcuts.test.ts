import { describe, expect, test } from "vitest";
import { queueShortcutFor, shortcutFor } from "./shortcuts";

const key = (k: string, extra: Partial<Parameters<typeof shortcutFor>[0]> = {}) =>
  shortcutFor({
    key: k,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: document.body,
    ...extra,
  });

const element = (html: string) => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  return wrapper.firstElementChild as HTMLElement;
};

describe("shortcutFor", () => {
  test.each([
    [" ", "toggle"],
    ["k", "toggle"],
    ["K", "toggle"],
    ["ArrowLeft", "seekBackward"],
    ["ArrowRight", "seekForward"],
    ["m", "toggleMute"],
    ["r", "cycleRepeat"],
  ])("%j → %s", (k, action) => {
    expect(key(k)).toBe(action);
  });

  test("Shift + arrows change track", () => {
    expect(key("ArrowLeft", { shiftKey: true })).toBe("previous");
    expect(key("ArrowRight", { shiftKey: true })).toBe("next");
  });

  test("ignores other keys and browser/OS shortcuts", () => {
    expect(key("a")).toBeNull();
    expect(key("ArrowUp")).toBeNull();
    expect(key("r", { ctrlKey: true })).toBeNull(); // reload
    expect(key("ArrowLeft", { altKey: true })).toBeNull(); // history back
    expect(key("k", { metaKey: true })).toBeNull();
    expect(key(" ", { shiftKey: true })).toBeNull();
  });

  test("never steals keys while typing", () => {
    for (const html of [
      '<input type="text" />',
      '<input type="search" />',
      "<textarea></textarea>",
      "<select></select>",
      '<div contenteditable="true"></div>',
    ]) {
      const target = element(html);
      if (target.hasAttribute("contenteditable")) {
        Object.defineProperty(target, "isContentEditable", { value: true });
      }
      expect(key(" ", { target })).toBeNull();
      expect(key("m", { target })).toBeNull();
    }
  });

  test("Space on a button clicks it instead of toggling twice", () => {
    expect(key(" ", { target: element("<button>x</button>") })).toBeNull();
    expect(key(" ", { target: element('<div role="button">x</div>') })).toBeNull();
    expect(key("m", { target: element("<button>x</button>") })).toBe("toggleMute");
  });

  test("sliders keep their arrows but not the other shortcuts", () => {
    const slider = element('<input type="range" />');
    expect(key("ArrowLeft", { target: slider })).toBeNull();
    expect(key(" ", { target: slider })).toBe("toggle");
  });
});

describe("queueShortcutFor", () => {
  const combo = (k: string, extra: Partial<Parameters<typeof queueShortcutFor>[0]> = {}) =>
    queueShortcutFor({
      key: k,
      shiftKey: false,
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      target: document.body,
      ...extra,
    });

  test("Ctrl/⌘+Z undoes, with Shift (or Ctrl+Y) redoes", () => {
    expect(combo("z")).toBe("undo");
    expect(combo("z", { ctrlKey: false, metaKey: true })).toBe("undo");
    expect(combo("Z", { shiftKey: true })).toBe("redo");
    expect(combo("y")).toBe("redo");
  });

  test("needs Ctrl or ⌘ and ignores Alt and other keys", () => {
    expect(combo("z", { ctrlKey: false })).toBeNull();
    expect(combo("z", { altKey: true })).toBeNull();
    expect(combo("x")).toBeNull();
  });

  test("text fields keep their own undo", () => {
    expect(combo("z", { target: element("<input type='text'>") })).toBeNull();
    expect(combo("z", { target: element("<textarea></textarea>") })).toBeNull();
  });

  test("the player shortcuts ignore Ctrl+Z", () => {
    expect(key("z", { ctrlKey: true })).toBeNull();
  });
});
