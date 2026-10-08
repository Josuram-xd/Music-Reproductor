"use client";

import { useEffect } from "react";
import type { UserSettings } from "@/lib/settings/settings";
import { settings } from "@/stores/settings-store";

/** Puts the user's saved preferences in the client store. Renders nothing. */
export function SettingsHydrator({ values }: { values: UserSettings }) {
  useEffect(() => settings.hydrate(values), [values]);
  return null;
}
