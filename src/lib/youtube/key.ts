/** Google API keys look like "AIza" + 35 characters. */
export const YOUTUBE_KEY = /^AIza[0-9A-Za-z_-]{35}$/;

/** Trimmed key if it looks valid, else `null`. */
export function cleanYouTubeKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return YOUTUBE_KEY.test(key) ? key : null;
}

/** "…wXyZ": the end of the key, to recognise it without showing it. */
export function keyHint(key: string): string {
  return `…${key.slice(-4)}`;
}
