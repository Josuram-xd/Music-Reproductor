import type { TrackSource } from "@/lib/player/types";

export type StatsPeriod = "week" | "month" | "all";
export const STATS_PERIODS: readonly StatsPeriod[] = ["week", "month", "all"];
export const PERIOD_LABELS: Record<StatsPeriod, string> = {
  week: "Semana",
  month: "Mes",
  all: "Siempre",
};
export const TOP_SIZES = [5, 10] as const;
export type TopSize = (typeof TOP_SIZES)[number];

export const DETAILS_URL = "/api/stats/details";

/** One row of a ranking (track, artist, folder or skipped track). */
export interface RankItem {
  key: string;
  label: string;
  sublabel: string | null;
  /** Seconds listened, or skips for the "most skipped" list. */
  value: number;
  plays: number;
}

export interface StatsDetails {
  tracks: RankItem[];
  artists: RankItem[];
  folders: RankItem[];
  skipped: RankItem[];
  /** 7 weekdays (Monday first) × 24 hours, seconds listened. */
  heatmap: number[][];
  bySource: Record<TrackSource, number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parsePeriod(value: unknown): StatsPeriod {
  return STATS_PERIODS.find((p) => p === value) ?? "month";
}

export function parseTopSize(value: unknown): TopSize {
  return TOP_SIZES.find((size) => String(size) === String(value)) ?? 5;
}

/** First instant of the period (rolling: last 7 / 30 days, or the beginning). */
export function periodStart(period: StatsPeriod, now: number): string {
  if (period === "all") return new Date(0).toISOString();
  return new Date(now - (period === "week" ? 7 : 30) * DAY_MS).toISOString();
}

type Numeric = number | string;

export function toRankItems(
  rows: readonly {
    key: string;
    label: string;
    sublabel: string | null;
    listened_s?: Numeric;
    skips?: Numeric;
    plays: Numeric;
  }[],
): RankItem[] {
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    sublabel: row.sublabel,
    value: Number(row.listened_s ?? row.skips) || 0,
    plays: Number(row.plays) || 0,
  }));
}

/** Sparse (weekday, hour, seconds) rows → a full 7 × 24 grid. */
export function toHeatmap(
  rows: readonly { weekday: Numeric; hour: Numeric; listened_s: Numeric }[],
): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const row of rows) {
    const day = Number(row.weekday);
    const hour = Number(row.hour);
    if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
      grid[day]![hour]! += Number(row.listened_s) || 0;
    }
  }
  return grid;
}

export function toBySource(
  rows: readonly { source: string; listened_s: Numeric }[],
): Record<TrackSource, number> {
  const totals: Record<TrackSource, number> = { audio: 0, youtube: 0, spotify: 0 };
  for (const row of rows) {
    if (row.source in totals) totals[row.source as TrackSource] += Number(row.listened_s) || 0;
  }
  return totals;
}

/** The busiest weekday/hour, or null without data (for the heatmap caption). */
export function peakCell(grid: readonly number[][]): { weekday: number; hour: number } | null {
  let peak: { weekday: number; hour: number } | null = null;
  let best = 0;
  for (let weekday = 0; weekday < grid.length; weekday++) {
    for (let hour = 0; hour < (grid[weekday]?.length ?? 0); hour++) {
      const value = grid[weekday]![hour]!;
      if (value > best) {
        best = value;
        peak = { weekday, hour };
      }
    }
  }
  return peak;
}
