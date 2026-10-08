import type { FloatingPosition } from "@/lib/settings/settings";

/** Free space for the widget (px, viewport coordinates): not over the queue, header or tabs. */
export interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Gap between the widget and the edges of the free area. */
export const EDGE_MARGIN = 16;

/** Where a new widget starts: bottom right, like the old fixed bar's controls. */
export const DEFAULT_POSITION: FloatingPosition = { edge: "right", y: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Room left to move vertically once the widget and the margins are subtracted. */
function verticalRoom(size: Size, area: Area): number {
  return Math.max(0, area.bottom - area.top - size.height - 2 * EDGE_MARGIN);
}

/**
 * Top-left corner (px) for a saved position. Always inside the area, so a
 * smaller window (or the queue column appearing) never pushes it off screen.
 */
export function toPixels(position: FloatingPosition | null, size: Size, area: Area): Point {
  const { edge, y } = position ?? DEFAULT_POSITION;
  const x =
    edge === "left"
      ? area.left + EDGE_MARGIN
      : Math.max(area.left + EDGE_MARGIN, area.right - EDGE_MARGIN - size.width);
  return { x, y: area.top + EDGE_MARGIN + clamp(y, 0, 1) * verticalRoom(size, area) };
}

/** Where a drop at `point` (top-left corner) sticks: the nearest side edge, same height. */
export function snapToEdge(point: Point, size: Size, area: Area): FloatingPosition {
  const center = point.x + size.width / 2;
  const edge = center < (area.left + area.right) / 2 ? "left" : "right";
  const room = verticalRoom(size, area);
  const y = room > 0 ? clamp((point.y - area.top - EDGE_MARGIN) / room, 0, 1) : 1;
  return { edge, y: Math.round(y * 1000) / 1000 };
}

/** Keyboard moves on the drag handle: ↑↓ by a tenth of the height, ←→ change edge. */
export function nudge(position: FloatingPosition | null, key: string): FloatingPosition | null {
  const current = position ?? DEFAULT_POSITION;
  switch (key) {
    case "ArrowUp":
      return { ...current, y: Math.round(clamp(current.y - 0.1, 0, 1) * 10) / 10 };
    case "ArrowDown":
      return { ...current, y: Math.round(clamp(current.y + 0.1, 0, 1) * 10) / 10 };
    case "ArrowLeft":
      return { ...current, edge: "left" };
    case "ArrowRight":
      return { ...current, edge: "right" };
    default:
      return null;
  }
}

/** Attribute on layout parts the widget must not cover, with the side they take. */
export const AVOID_ATTR = "data-floating-avoid";
export type AvoidSide = "top" | "right" | "bottom";

/**
 * The viewport minus the visible layout parts marked with `data-floating-avoid`
 * (header on top, queue column on the right, tab bar at the bottom).
 */
export function freeArea(
  viewport: Size,
  avoid: readonly {
    side: AvoidSide;
    rect: { left: number; top: number; bottom: number; width: number; height: number };
  }[],
): Area {
  const area: Area = { left: 0, top: 0, right: viewport.width, bottom: viewport.height };
  for (const { side, rect } of avoid) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (side === "top") area.top = Math.max(area.top, rect.bottom);
    if (side === "right") area.right = Math.min(area.right, rect.left);
    if (side === "bottom") area.bottom = Math.min(area.bottom, rect.top);
  }
  return area;
}
