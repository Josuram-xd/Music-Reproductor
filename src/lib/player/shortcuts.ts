/** Queue edits, handled by the queue store (they are not player actions). */
export type QueueAction = "undo" | "redo";

export type PlayerAction =
  "toggle" | "seekBackward" | "seekForward" | "previous" | "next" | "toggleMute" | "cycleRepeat";

/** Shortcuts shown in the UI (Spanish labels). */
export const SHORTCUTS: readonly { keys: string; label: string }[] = [
  { keys: "Espacio / K", label: "Reproducir / pausar" },
  { keys: "← / →", label: "−10 s / +10 s" },
  { keys: "Shift + ← / →", label: "Anterior / siguiente" },
  { keys: "M", label: "Silenciar" },
  { keys: "R", label: "Repetir: no / todo / una" },
  { keys: "Ctrl + Z", label: "Deshacer el último cambio de la cola" },
  { keys: "Ctrl + Shift + Z / Ctrl + Y", label: "Rehacer en la cola" },
];

interface KeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

/** True when typing or using a control that already handles the key. */
function isInteractive(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    // Sliders keep their arrows; other inputs keep every key.
    return (target as HTMLInputElement).type !== "range" || key.startsWith("Arrow");
  }
  // Space/Enter already "click" buttons and links.
  if (
    (tag === "BUTTON" || tag === "A" || target.getAttribute("role") === "button") &&
    key === " "
  ) {
    return true;
  }
  return false;
}

/** Maps a keydown to a player action, or `null` to let the page handle it. */
export function shortcutFor(event: KeyLike): PlayerAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isInteractive(event.target, event.key)) return null;

  switch (event.key) {
    case " ":
    case "k":
    case "K":
      return event.shiftKey ? null : "toggle";
    case "ArrowLeft":
      return event.shiftKey ? "previous" : "seekBackward";
    case "ArrowRight":
      return event.shiftKey ? "next" : "seekForward";
    case "m":
    case "M":
      return "toggleMute";
    case "r":
    case "R":
      return "cycleRepeat";
    default:
      return null;
  }
}

/**
 * Ctrl/⌘+Z undoes the last queue edit; Ctrl/⌘+Shift+Z or Ctrl+Y redoes it.
 * Text fields keep their own undo.
 */
export function queueShortcutFor(event: KeyLike): QueueAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (isInteractive(event.target, key)) return null;
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";
  return null;
}
