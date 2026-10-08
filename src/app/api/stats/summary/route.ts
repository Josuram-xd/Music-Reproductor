import { NextResponse } from "next/server";
import { apiError, authenticate } from "@/lib/auth/api";
import { cleanTimeZone } from "@/lib/stats/format";
import { toSummary } from "@/lib/stats/summary";

/** `GET /api/stats/summary?tz=…`: KPI cards (days and streaks in the user's time zone). */
export async function GET(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);

  const tz = cleanTimeZone(new URL(request.url).searchParams.get("tz"));
  const { data, error } = await auth.supabase.rpc("stats_summary", { p_tz: tz });
  if (error) return apiError("failed", 500);
  return NextResponse.json(toSummary(data?.[0]), { headers: { "Cache-Control": "no-store" } });
}
