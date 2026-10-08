"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  DETAILS_URL,
  PERIOD_LABELS,
  STATS_PERIODS,
  type StatsDetails as Details,
  type StatsPeriod,
  TOP_SIZES,
  type TopSize,
} from "@/lib/stats/details";
import { browserTimeZone } from "@/lib/stats/format";
import { DeleteHistory } from "./delete-history";
import { Heatmap, RankList, SourceBars } from "./stats-charts";
import { LoadingCat } from "@/components/ui/pixel/pixel";

type Status = { kind: "loading" } | { kind: "error" } | { kind: "done"; details: Details };

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-2xl bg-surface-2 p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className="h-9 rounded-xl px-3 text-sm font-semibold text-muted transition hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none aria-pressed:bg-surface aria-pressed:text-primary"
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

/**
 * Tops (tracks, artists, folders) for a period, the weekday × hour heatmap,
 * the most skipped tracks, time per source and "Borrar mi historial".
 */
export function StatsDetails() {
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [top, setTop] = useState<TopSize>(5);
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  const load = useCallback(
    (signal: AbortSignal) => {
      const params = new URLSearchParams({ period, top: String(top), tz: browserTimeZone() });
      return fetch(`${DETAILS_URL}?${params}`, { cache: "no-store", signal })
        .then((response) => (response.ok ? (response.json() as Promise<Details>) : null))
        .then((details) => setStatus(details ? { kind: "done", details } : { kind: "error" }))
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setStatus({ kind: "error" });
          }
        });
    },
    [period, top],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Periodo"
          options={STATS_PERIODS}
          value={period}
          format={(p) => PERIOD_LABELS[p]}
          onChange={setPeriod}
        />
        <Segmented
          label="Tamaño del top"
          options={TOP_SIZES}
          value={top}
          format={(size) => `Top ${size}`}
          onChange={setTop}
        />
      </div>

      {status.kind === "loading" ? (
        <LoadingCat label="Contando tus canciones…" />
      ) : status.kind === "error" ? (
        <p role="alert" className="rounded-2xl border border-danger/50 bg-surface p-4 text-sm">
          No se pudieron cargar tus estadísticas. Recarga la página, nya~
        </p>
      ) : (
        <div aria-live="polite" className="flex flex-col gap-4">
          <div className="grid gap-4 @desktop:grid-cols-3">
            <Panel title="Canciones">
              <RankList items={status.details.tracks} unit="time" empty="Aún nada por aquí" />
            </Panel>
            <Panel title="Artistas">
              <RankList items={status.details.artists} unit="time" empty="Aún nada por aquí" />
            </Panel>
            <Panel title="Carpetas">
              <RankList
                items={status.details.folders}
                unit="time"
                empty="Escucha canciones de tus carpetas y aparecerán aquí"
              />
            </Panel>
          </div>
          <Panel title="¿Cuándo escuchas?">
            <Heatmap grid={status.details.heatmap} />
          </Panel>
          <div className="grid gap-4 @desktop:grid-cols-2">
            <Panel title="Tiempo por fuente">
              <SourceBars bySource={status.details.bySource} />
            </Panel>
            <Panel title="Las más saltadas">
              <RankList
                items={status.details.skipped}
                unit="skips"
                empty="No has saltado ninguna, qué buen gusto"
              />
            </Panel>
          </div>
        </div>
      )}

      <div>
        {/* Reload: the KPI cards and these panels all start from zero. */}
        <DeleteHistory onDeleted={() => window.location.reload()} />
      </div>
    </div>
  );
}
