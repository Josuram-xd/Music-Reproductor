import { NextResponse } from "next/server";
import { apiError, authenticate, readJson } from "@/lib/auth/api";
import { recommend } from "@/lib/radio/server";

const MAX_COUNT = 10;
const MAX_EXCLUDE = 2000;

/**
 * `POST /api/radio/recommendations` `{ count?, exclude? }`: neko radio
 * picks for the signed-in user. `exclude` = keys of the queued tracks.
 */
export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);

  const body = await readJson(request);
  const count = Math.min(MAX_COUNT, Math.max(1, Math.round(Number(body?.count) || 5)));
  const exclude = Array.isArray(body?.exclude)
    ? body.exclude.filter((key): key is string => typeof key === "string").slice(0, MAX_EXCLUDE)
    : [];

  try {
    const tracks = await recommend(auth.supabase, auth.userId, {
      count,
      exclude: new Set(exclude),
    });
    return NextResponse.json({ tracks }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return apiError("failed", 500);
  }
}
