import type { TrackSource } from "@/lib/player/types";
import { type RankItem, peakCell } from "@/lib/stats/details";
import { formatDuration } from "@/lib/stats/format";

/** Monday first, like the `stats_heatmap` rows. */
export const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
const SOURCE_LABELS: Record<TrackSource, string> = {
  audio: "Archivos",
  youtube: "YouTube",
  spotify: "Spotify",
};

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/**
 * Ranking as a list with one-hue (pink) bars, scaled to the first row.
 * Values are written next to each bar, so color is never the only cue.
 */
export function RankList({
  items,
  unit,
  empty,
}: {
  items: readonly RankItem[];
  /** "time": seconds listened; "skips": number of skips. */
  unit: "time" | "skips";
  empty: string;
}) {
  if (items.length === 0) return <p className="py-4 text-sm text-muted">{empty}</p>;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, index) => {
        const value =
          unit === "time"
            ? formatDuration(item.value)
            : `${item.value} ${item.value === 1 ? "salto" : "saltos"}`;
        return (
          <li
            key={item.key}
            title={`${item.label}: ${value} · ${item.plays} ${item.plays === 1 ? "vez" : "veces"}`}
            className="flex flex-col gap-1"
          >
            <span className="flex items-baseline gap-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-muted tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{item.label}</span>
                {item.sublabel ? <span className="text-muted"> · {item.sublabel}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-muted tabular-nums">{value}</span>
            </span>
            <span aria-hidden className="ml-7 h-1.5 rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Time per source as labelled bars (share of the period's total). */
export function SourceBars({ bySource }: { bySource: Record<TrackSource, number> }) {
  const total = Object.values(bySource).reduce((sum, value) => sum + value, 0);
  if (total === 0) return <p className="py-4 text-sm text-muted">Sin escuchas en este periodo.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {(Object.keys(SOURCE_LABELS) as TrackSource[]).map((source) => {
        const share = bySource[source] / total;
        return (
          <li key={source} className="flex flex-col gap-1">
            <span className="flex justify-between text-sm">
              <span className="font-semibold">{SOURCE_LABELS[source]}</span>
              <span className="text-xs text-muted tabular-nums">
                {formatDuration(bySource[source])} · {Math.round(share * 100)} %
              </span>
            </span>
            <span aria-hidden className="h-1.5 rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${share * 100}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Lavender → pink (docs/DESIGN.md), more opaque the more was listened. */
function cellColor(ratio: number): string {
  if (ratio <= 0) return "var(--surface-2)";
  const pink = Math.round(ratio * 100);
  const alpha = Math.round((35 + ratio * 65) * 10) / 10;
  return `color-mix(in oklab, color-mix(in oklab, var(--primary) ${pink}%, var(--secondary)) ${alpha}%, transparent)`;
}

/**
 * Weekday × hour heatmap of time listened, with a tooltip per cell, the
 * favourite hour as a caption and an equivalent table for screen readers.
 */
export function Heatmap({ grid }: { grid: readonly number[][] }) {
  const max = Math.max(...grid.flat(), 0);
  const peak = peakCell(grid);
  if (!peak || max === 0) {
    return <p className="py-4 text-sm text-muted">Sin escuchas en este periodo.</p>;
  }
  return (
    <figure className="flex flex-col gap-3">
      <div aria-hidden className="overflow-x-auto">
        <div className="grid min-w-[36rem] grid-cols-[1.5rem_repeat(24,minmax(0,1fr))] gap-[2px]">
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="text-center text-[0.6rem] text-muted tabular-nums">
              {hour % 3 === 0 ? hour : ""}
            </span>
          ))}
          {grid.map((hours, weekday) => (
            <div key={weekday} className="contents">
              <span className="text-xs leading-5 text-muted">{WEEKDAY_SHORT[weekday]}</span>
              {hours.map((value, hour) => (
                <span
                  key={hour}
                  title={`${WEEKDAYS[weekday]} ${hourLabel(hour)} · ${formatDuration(value)}`}
                  className="h-5 transition-transform hover:scale-125"
                  style={{ background: cellColor(value / max) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          Tu hora favorita: <strong className="text-text">{WEEKDAYS[peak.weekday]}</strong> a las{" "}
          <strong className="text-text">{hourLabel(peak.hour)}</strong>
        </span>
        <span aria-hidden className="flex items-center gap-1">
          menos
          {[0.1, 0.4, 0.7, 1].map((ratio) => (
            <span key={ratio} className="size-3" style={{ background: cellColor(ratio) }} />
          ))}
          más
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Minutos escuchados por día de la semana y hora</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            <th scope="col">Horas con música</th>
          </tr>
        </thead>
        <tbody>
          {grid.map((hours, weekday) => (
            <tr key={weekday}>
              <th scope="row">{WEEKDAYS[weekday]}</th>
              <td>
                {hours
                  .map((value, hour) =>
                    value > 0 ? `${hourLabel(hour)}: ${formatDuration(value)}` : null,
                  )
                  .filter(Boolean)
                  .join(", ") || "nada"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
