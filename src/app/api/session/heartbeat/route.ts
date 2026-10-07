import { NextResponse } from "next/server";
import { lastSeenCookie, sessionConfig } from "@/lib/session/config";
import { createClient } from "@/lib/supabase/server";

export interface HeartbeatResponse {
  lastSeen: number;
  graceSeconds: number;
}

/**
 * Sign of life sent by the client every 30 s. Renews the signed
 * `pl_last_seen` cookie. The proxy has already rejected expired sessions
 * with a 401 before this runs.
 */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const body: HeartbeatResponse = { lastSeen: now, graceSeconds: sessionConfig().graceSeconds };
  const response = NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(await lastSeenCookie(userId, now));
  return response;
}
