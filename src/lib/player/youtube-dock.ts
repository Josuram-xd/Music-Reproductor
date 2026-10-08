/** Where the YouTube video should be drawn. */
export type DockPlacement =
  | { mode: "docked"; left: number; top: number; width: number; height: number }
  | { mode: "floating" };

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Fraction of the slot that must be on screen to dock there instead of floating. */
export const MIN_VISIBLE = 0.6;

/**
 * Docks over the first slot that is mostly visible: inside the viewport and
 * inside its clipping container (e.g. the scrolled queue column).
 */
export function chooseDockPlacement(
  slots: readonly { rect: Rect; clip: Rect | null }[],
  viewport: { width: number; height: number },
): DockPlacement {
  for (const { rect, clip } of slots) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const bounds = clip ?? { left: 0, top: 0, ...viewport };
    const top = Math.max(rect.top, bounds.top, 0);
    const bottom = Math.min(rect.top + rect.height, bounds.top + bounds.height, viewport.height);
    const left = Math.max(rect.left, bounds.left, 0);
    const right = Math.min(rect.left + rect.width, bounds.left + bounds.width, viewport.width);
    const visible = Math.max(0, bottom - top) * Math.max(0, right - left);
    if (visible >= rect.width * rect.height * MIN_VISIBLE) {
      return { mode: "docked", ...rect };
    }
  }
  return { mode: "floating" };
}
