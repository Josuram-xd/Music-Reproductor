import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** For route handlers: the Supabase client and verified user id, or `null`. */
export async function authenticate() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return userId ? { supabase, userId } : null;
}

/** `{ error: code }` JSON response; codes are mapped to Spanish in the client. */
export function apiError(code: string, status: number) {
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Parses a JSON body, or `null` if it is not a JSON object. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
