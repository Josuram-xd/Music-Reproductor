"use client";

import { CircleAlert, CircleCheck, Film, Music, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { type UploadItem, type UploadStatus, useUploadStore } from "@/stores/upload-store";

const STATUS_LABELS: Record<UploadStatus, string> = {
  queued: "En cola…",
  "loading-ffmpeg": "Preparando el extractor de audio (solo la primera vez)…",
  extracting: "Sacando el audio del vídeo…",
  uploading: "Subiendo…",
  saving: "Guardando…",
  done: "¡Listo, nya~!",
  error: "",
};

const ACTIVE: UploadStatus[] = ["queued", "loading-ffmpeg", "extracting", "uploading", "saving"];

function Row({ item, onCancel }: { item: UploadItem; onCancel: () => void }) {
  const active = ACTIVE.includes(item.status);
  const Icon = item.kind === "video" ? Film : Music;
  const percent = Math.round(item.progress * 100);
  const showBar = item.status === "uploading" || item.status === "extracting";

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface p-3">
      <Icon aria-hidden className="size-5 shrink-0 text-secondary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        {item.status === "error" ? (
          <p className="flex items-center gap-1 text-xs text-danger">
            <CircleAlert aria-hidden className="size-3.5" /> {item.error}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted">
            {item.status === "done" ? (
              <CircleCheck aria-hidden className="size-3.5 text-accent" />
            ) : null}
            {STATUS_LABELS[item.status]}
            {showBar ? ` ${percent}%` : null}
          </p>
        )}
        {active ? (
          <div
            role="progressbar"
            aria-label={`Progreso de ${item.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={showBar ? percent : undefined}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className={`h-full rounded-full bg-primary transition-[width] duration-300 ${
                showBar ? "" : "w-1/3 motion-safe:animate-pulse"
              }`}
              style={showBar ? { width: `${percent}%` } : undefined}
            />
          </div>
        ) : null}
      </div>
      {active ? (
        <button
          type="button"
          onClick={onCancel}
          aria-label={`Cancelar ${item.name}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </li>
  );
}

/** Upload progress list. Refreshes the library when an upload finishes. */
export function UploadList() {
  const items = useUploadStore((s) => s.items);
  const completed = useUploadStore((s) => s.completed);
  const cancel = useUploadStore((s) => s.cancel);
  const clearFinished = useUploadStore((s) => s.clearFinished);
  const router = useRouter();

  useEffect(() => {
    if (completed > 0) router.refresh();
  }, [completed, router]);

  if (items.length === 0) return null;
  const finished = items.some((item) => item.status === "done" || item.status === "error");

  return (
    <section aria-label="Subidas" className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <Row key={item.id} item={item} onCancel={() => cancel(item.id)} />
        ))}
      </ul>
      {finished ? (
        <button
          type="button"
          onClick={clearFinished}
          className="self-end rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text"
        >
          Limpiar terminadas
        </button>
      ) : null}
    </section>
  );
}
