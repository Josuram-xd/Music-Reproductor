/**
 * Where the floating mini-player was left: stuck to the left or right edge,
 * at a fraction of the free height (0 = top, 1 = bottom). Relative values
 * keep it on screen when the window is resized.
 */
export interface FloatingPosition {
  edge: "left" | "right";
  y: number;
}

export interface UserSettings {
  floatingPlayer: boolean;
  floatingPos: FloatingPosition | null;
  radioEnabled: boolean;
}

/** No row in `user_settings` (or it could not be read) = these. */
export const DEFAULT_SETTINGS: UserSettings = {
  floatingPlayer: true,
  floatingPos: null,
  radioEnabled: true,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Validates a stored/sent position, or `null`. */
export function parseFloatingPosition(value: unknown): FloatingPosition | null {
  if (!value || typeof value !== "object") return null;
  const { edge, y } = value as Record<string, unknown>;
  if ((edge !== "left" && edge !== "right") || typeof y !== "number" || !Number.isFinite(y)) {
    return null;
  }
  return { edge, y: clamp01(y) };
}

/** Validates a partial update from the client; unknown keys are dropped. */
export function parseSettingsPatch(value: unknown): Partial<UserSettings> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const patch: Partial<UserSettings> = {};
  if ("floatingPlayer" in raw) {
    if (typeof raw.floatingPlayer !== "boolean") return null;
    patch.floatingPlayer = raw.floatingPlayer;
  }
  if ("radioEnabled" in raw) {
    if (typeof raw.radioEnabled !== "boolean") return null;
    patch.radioEnabled = raw.radioEnabled;
  }
  if ("floatingPos" in raw) {
    const pos = raw.floatingPos === null ? null : parseFloatingPosition(raw.floatingPos);
    if (raw.floatingPos !== null && !pos) return null;
    patch.floatingPos = pos;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
