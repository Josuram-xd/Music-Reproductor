"use client";

import { Cat, Headphones, Hourglass, Timer } from "lucide-react";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { browserTimeZone, formatClock, formatDays, formatDuration } from "@/lib/stats/format";
import { EMPTY_SUMMARY, type StatsSummary, SUMMARY_URL } from "@/lib/stats/summary";

type Status = { kind: "loading" } | { kind: "error" } | { kind: "done"; summary: StatsSummary };

function Card({
  icon,
  label,
  value,
  detail,
  live = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  live?: boolean;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-3xl bg-surface p-4">
      <span className="flex items-center gap-2 text-sm text-muted">
        <span className="flex size-8 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          {icon}
        </span>
        {label}
        {live ? (
          <span className="ml-auto size-2 rounded-full bg-accent motion-safe:animate-pulse" />
        ) : null}
      </span>
      <span
        className="font-display text-2xl font-semibold tabular-nums"
        aria-live={live ? "off" : undefined}
      >
        {value}
      </span>
      <span className="text-xs text-muted">{detail}</span>
    </li>
  );
}

function subscribeToClock(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

/**
 * Seconds since `since`, updated every second (null = no open session).
 * A store, not state: the clock is only read in the browser (prerendering
 * must not depend on the current time).
 */
function useElapsed(since: string | null): number | null {
  const now = useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / 1000),
    () => null,
  );
  return since && now !== null ? Math.max(0, now - Date.parse(since) / 1000) : null;
}

/**
 * KPI cards: time listened, time in the app, the current session (live)
 * and the streak of days in a row with music.
 */
export function StatsKpis() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`${SUMMARY_URL}?tz=${encodeURIComponent(browserTimeZone())}`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<StatsSummary>) : null))
      .then((summary) => {
        if (!cancelled) setStatus(summary ? { kind: "done", summary } : { kind: "error" });
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = status.kind === "done" ? status.summary : EMPTY_SUMMARY;
  const session = useElapsed(summary.sessionStartedAt);

  if (status.kind === "loading") {
    return (
      <ul
        aria-label="Cargando estadísticas"
        className="grid grid-cols-2 gap-3 @desktop:grid-cols-4"
      >
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="h-32 animate-pulse rounded-3xl bg-surface" />
        ))}
      </ul>
    );
  }
  if (status.kind === "error") {
    return (
      <p role="alert" className="rounded-2xl border border-danger/50 bg-surface p-4 text-sm">
        No se pudieron cargar tus estadísticas. Recarga la página, nya~
      </p>
    );
  }

  return (
    <ul aria-label="Resumen" className="grid grid-cols-2 gap-3 @desktop:grid-cols-4">
      <Card
        icon={<Headphones aria-hidden className="size-4" />}
        label="Tiempo escuchado"
        value={formatDuration(summary.listenedS)}
        detail={`${summary.plays} ${summary.plays === 1 ? "reproducción" : "reproducciones"}`}
      />
      <Card
        icon={<Hourglass aria-hidden className="size-4" />}
        label="Tiempo de uso"
        value={formatDuration(summary.usageS)}
        detail="Suma de tus sesiones en Purrlist"
      />
      <Card
        icon={<Timer aria-hidden className="size-4" />}
        label="Sesión actual"
        value={session === null ? "—" : formatClock(session)}
        detail={session === null ? "Empieza en unos segundos" : "En vivo"}
        live={session !== null}
      />
      <Card
        icon={<Cat aria-hidden className="size-4" />}
        label="Racha"
        value={formatDays(summary.streakDays)}
        detail={
          summary.streakDays > 0
            ? "Seguidos escuchando música 🐾"
            : "Escucha algo hoy y empieza una"
        }
      />
    </ul>
  );
}
