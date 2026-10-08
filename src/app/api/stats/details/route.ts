import { NextResponse } from "next/server";
import { apiError, authenticate } from "@/lib/auth/api";
import {
  parsePeriod,
  parseTopSize,
  periodStart,
  type StatsDetails,
  toBySource,
  toHeatmap,
  toRankItems,
} from "@/lib/stats/details";
import { cleanTimeZone } from "@/lib/stats/format";

/**
 * `GET /api/stats/details?period=week|month|all&top=5|10&tz=…`: tops, heatmap,
 * most skipped and time per source for the period (SQL functions stats_*).
 */
export async function GET(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);
  const { supabase } = auth;

  const params = new URL(request.url).searchParams;
  const since = periodStart(parsePeriod(params.get("period")), Date.now());
  const limit = parseTopSize(params.get("top"));
  const tz = cleanTimeZone(params.get("tz"));

  const [tracks, artists, folders, skipped, heatmap, bySource] = await Promise.all([
    supabase.rpc("stats_top", { p_kind: "track", p_since: since, p_limit: limit }),
    supabase.rpc("stats_top", { p_kind: "artist", p_since: since, p_limit: limit }),
    supabase.rpc("stats_top", { p_kind: "folder", p_since: since, p_limit: limit }),
    supabase.rpc("stats_most_skipped", { p_since: since, p_limit: limit }),
    supabase.rpc("stats_heatmap", { p_since: since, p_tz: tz }),
    supabase.rpc("stats_by_source", { p_since: since }),
  ]);
  if ([tracks, artists, folders, skipped, heatmap, bySource].some((result) => result.error)) {
    return apiError("failed", 500);
  }

  const body: StatsDetails = {
    tracks: toRankItems(tracks.data ?? []),
    artists: toRankItems(artists.data ?? []),
    folders: toRankItems(folders.data ?? []),
    skipped: toRankItems(skipped.data ?? []),
    heatmap: toHeatmap(heatmap.data ?? []),
    bySource: toBySource(bySource.data ?? []),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
