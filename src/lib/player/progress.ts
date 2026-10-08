import type { CSSProperties } from "react";

/** `--progress` for `.paw-slider`: how much of the pixel track is filled (0–100 %). */
export function progressStyle(value: number, max: number): CSSProperties {
  const ratio = max > 0 && Number.isFinite(value) ? Math.min(1, Math.max(0, value / max)) : 0;
  return { "--progress": `${Math.round(ratio * 1000) / 10}%` } as CSSProperties;
}
