import type { DropChoice } from "./queue-commands";

/** sessionStorage key: the "don't ask again this session" choice for drops on the current track. */
export const DROP_PREFERENCE_KEY = "purrlist:drop-choice";

const CHOICES: readonly DropChoice[] = ["playNow", "playNext"];

// sessionStorage can be missing or throw (private mode, blocked site data): treat it as empty.
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getDropPreference(): DropChoice | null {
  try {
    const value = storage()?.getItem(DROP_PREFERENCE_KEY);
    return CHOICES.find((choice) => choice === value) ?? null;
  } catch {
    return null;
  }
}

export function setDropPreference(choice: DropChoice): void {
  try {
    storage()?.setItem(DROP_PREFERENCE_KEY, choice);
  } catch {
    // Not persisted: the dialog simply asks again next time.
  }
}

export function clearDropPreference(): void {
  try {
    storage()?.removeItem(DROP_PREFERENCE_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
