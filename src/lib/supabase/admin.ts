import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Supabase client with the secret key: bypasses RLS. Only for server data
 * that belongs to no user (e.g. the shared YouTube search cache). Never use
 * it to read or write a user's rows.
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY (see .env.example)");
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
