"use server";

import { authenticate } from "@/lib/auth/api";

export type HistoryActionResult = { ok: true } | { ok: false; error: string };

/**
 * "Borrar mi historial": plays, searches and app sessions. The radio's
 * "No me gusta" and the settings stay (they are preferences, not history).
 */
export async function deleteHistory(): Promise<HistoryActionResult> {
  const auth = await authenticate();
  if (!auth) return { ok: false, error: "unauthorized" };
  const { supabase } = auth;
  // PostgREST needs a filter on delete; RLS limits it to the user's rows.
  const results = await Promise.all([
    supabase.from("play_events").delete().not("id", "is", null),
    supabase.from("search_history").delete().not("id", "is", null),
    supabase.from("app_sessions").delete().not("id", "is", null),
  ]);
  return results.some((result) => result.error) ? { ok: false, error: "failed" } : { ok: true };
}
