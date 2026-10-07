"use client";

import { useEffect } from "react";
import { clearDropPreference } from "@/lib/player/drop-preference";

/**
 * Login/register pages mean the session is over (sign out or expiry):
 * forget the "don't ask again this session" choices of this tab.
 */
export function ForgetSessionChoices() {
  useEffect(() => clearDropPreference(), []);
  return null;
}
