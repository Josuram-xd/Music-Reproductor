"use client";

import { FolderPlus, ListPlus, Play, Search, TriangleAlert } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { draggableProps } from "@/components/library/dnd";
import { EmptyState } from "@/components/ui/empty-state";
import type { LibraryFolder } from "@/lib/library/folders";
import { formatTime } from "@/lib/player/format";
import type { SpotifyResult } from "@/lib/spotify/api";
import { saveSpotifyTrack } from "@/lib/spotify/actions";
import { SPOTIFY_SEARCH_PATH } from "@/lib/spotify/config";
import { spotifySearchErrorMessage } from "@/lib/spotify/messages";
import { spotifyResultToTrack } from "@/lib/spotify/tracks";
import { usePlayerStore } from "@/stores/player-store";
import { queue } from "@/stores/queue-store";
import { toast } from "@/stores/toast-store";
import { SaveToFolderDialog } from "@/components/youtube/save-to-folder-dialog";
import { SAVE_VIDEO_MESSAGES, saveVideoErrorMessage } from "@/lib/youtube/save-messages";
import { LoadingCat } from "@/components/ui/pixel/pixel";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; results: SpotifyResult[] };

async function search(query: string): Promise<SpotifyResult[]> {
  const response = await fetch(`${SPOTIFY_SEARCH_PATH}?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as {
    results?: SpotifyResult[];
    error?: string;
  };
  if (!response.ok) throw new Error(body.error ?? "failed");
  return body.results ?? [];
}

const ICON_BUTTON =
  "flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none";

/** Searches the user's Spotify and plays or queues results (button or drag). */
export function SpotifySearchView({
  premium,
  folders = [],
}: {
  premium: boolean;
  folders?: LibraryFolder[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saving, setSaving] = useState<SpotifyResult | null>(null);
  const [pending, startTransition] = useTransition();
  const currentUri = usePlayerStore((s) => s.current?.externalId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setStatus({ kind: "loading" });
    try {
      setStatus({ kind: "done", results: await search(clean) });
    } catch (error) {
      setStatus({
        kind: "error",
        message: spotifySearchErrorMessage(error instanceof Error ? error.message : "failed"),
      });
    }
  };

  const save = (folderId: string | null, folderName: string) => {
    const result = saving;
    if (!result) return;
    startTransition(async () => {
      const response = await saveSpotifyTrack(result, folderId);
      if (!response.ok) {
        toast(saveVideoErrorMessage(response.error), { tone: "error" });
        return;
      }
      setSaving(null);
      toast(
        response.alreadySaved
          ? SAVE_VIDEO_MESSAGES.moved(folderName)
          : SAVE_VIDEO_MESSAGES.saved(folderName),
        { tone: "success", durationMs: 2500 },
      );
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {!premium ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-warn/50 bg-warn/10 p-3 text-sm"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
          Tu cuenta de Spotify no es Premium: puedes buscar y preparar la cola, pero Spotify no
          dejará que suene aquí.
        </p>
      ) : null}

      <form onSubmit={submit} className="flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Buscar en Spotify</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Canciones, artistas, álbumes…"
            autoComplete="off"
            className="h-11 w-full rounded-2xl border border-transparent bg-surface-2 pr-4 pl-10 text-text outline-none placeholder:text-muted focus:border-secondary focus:ring-2 focus:ring-secondary/40"
          />
        </label>
        <button
          type="submit"
          disabled={!query.trim() || status.kind === "loading"}
          className="h-11 shrink-0 rounded-2xl bg-accent px-5 font-display font-semibold text-bg transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:opacity-60"
        >
          Buscar
        </button>
      </form>

      <div aria-live="polite">
        {status.kind === "idle" ? (
          <EmptyState title="Busca en tu Spotify">
            Reproduce una canción o añádela a la cola, junto a tus archivos y vídeos
          </EmptyState>
        ) : status.kind === "loading" ? (
          <LoadingCat label="Buscando en Spotify…" />
        ) : status.kind === "error" ? (
          <p role="alert" className="rounded-2xl border border-danger/50 bg-surface p-4 text-sm">
            {status.message}
          </p>
        ) : status.results.length === 0 ? (
          <EmptyState title="Nada por aquí">Prueba con otras palabras, nya~</EmptyState>
        ) : (
          <ol className="flex flex-col gap-1">
            {status.results.map((result) => {
              const track = spotifyResultToTrack(result);
              const isCurrent = currentUri === result.uri;
              return (
                <li
                  key={result.id}
                  {...draggableProps({ kind: "track", id: track.id, track })}
                  className={`flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface ${
                    isCurrent ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {result.image ? (
                      // Spotify CDN images: next/image would need the domain configured.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.image}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${isCurrent ? "text-primary" : ""}`}>
                      {result.title}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {result.artists}
                      {result.album ? ` · ${result.album}` : ""}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-sm text-muted tabular-nums @tablet:inline">
                    {formatTime(result.durationS)}
                  </span>
                  <button
                    type="button"
                    onClick={() => queue.playNow(track)}
                    aria-label={`Reproducir ${result.title}`}
                    title="Reproducir ahora"
                    className={ICON_BUTTON}
                  >
                    <Play aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => queue.add(track)}
                    aria-label={`Añadir ${result.title} a la cola`}
                    title="Añadir a la cola"
                    className={ICON_BUTTON}
                  >
                    <ListPlus aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaving(result)}
                    aria-label={`Guardar ${result.title} en la biblioteca`}
                    title="Guardar en una carpeta"
                    className={ICON_BUTTON}
                  >
                    <FolderPlus aria-hidden className="size-4" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <SaveToFolderDialog
        title={saving?.title ?? null}
        folders={folders}
        pending={pending}
        onClose={() => setSaving(null)}
        onSave={save}
      />
    </div>
  );
}
