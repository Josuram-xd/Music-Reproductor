/** The KPI cards of "Mis stats" (from `stats_summary`). */
export interface StatsSummary {
  listenedS: number;
  plays: number;
  bySource: { audio: number; youtube: number; spotify: number };
  usageS: number;
  /** Start of the open app session (live counter), or null. */
  sessionStartedAt: string | null;
  streakDays: number;
}

export const EMPTY_SUMMARY: StatsSummary = {
  listenedS: 0,
  plays: 0,
  bySource: { audio: 0, youtube: 0, spotify: 0 },
  usageS: 0,
  sessionStartedAt: null,
  streakDays: 0,
};

export const SUMMARY_URL = "/api/stats/summary";

/** Postgres numerics arrive as strings: everything becomes a number here. */
export function toSummary(
  row:
    | {
        listened_s: number | string;
        plays: number | string;
        audio_s: number | string;
        youtube_s: number | string;
        spotify_s: number | string;
        usage_s: number | string;
        session_started_at: string | null;
        streak_days: number | string;
      }
    | undefined,
): StatsSummary {
  if (!row) return EMPTY_SUMMARY;
  return {
    listenedS: Number(row.listened_s) || 0,
    plays: Number(row.plays) || 0,
    bySource: {
      audio: Number(row.audio_s) || 0,
      youtube: Number(row.youtube_s) || 0,
      spotify: Number(row.spotify_s) || 0,
    },
    usageS: Number(row.usage_s) || 0,
    sessionStartedAt: row.session_started_at,
    streakDays: Number(row.streak_days) || 0,
  };
}
