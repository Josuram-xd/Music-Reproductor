"use client";

import { FolderPlus, ListPlus, Play, Search } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { draggableProps } from "@/components/library/dnd";
import { EmptyState } from "@/components/ui/empty-state";
import type { LibraryFolder } from "@/lib/library/folders";
import { formatTime } from "@/lib/player/format";
import { saveYouTubeVideo } from "@/lib/youtube/actions";
import { userKeyProblemMessage, youtubeSearchErrorMessage } from "@/lib/youtube/messages";
import { SAVE_VIDEO_MESSAGES, saveVideoErrorMessage } from "@/lib/youtube/save-messages";
import type { SearchResult } from "@/lib/youtube/search";
import { resultToTrack } from "@/lib/youtube/tracks";
import type { YouTubeResult } from "@/lib/youtube/types";
import { usePlayerStore } from "@/stores/player-store";
import { queue } from "@/stores/queue-store";
import { toast } from "@/stores/toast-store";
import { SaveToFolderDialog } from "./save-to-folder-dialog";
import { LoadingCat } from "@/components/ui/pixel/pixel";

export const SEARCH_URL = "/api/youtube/search";

type Response = Extract<SearchResult, { ok: true }>["response"];

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; response: Response };

async function search(query: string): Promise<Response> {
  const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Response & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "failed");
  return body;
}

const ICON_BUTTON =
  "flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none";

/**
 * Searches YouTube (through our API: the key stays on the server) and lets
 * the user play a result, add it to the queue (button or drag) or save it
 * in a library folder.
 */
export function YouTubeSearchView({ folders }: { folders: LibraryFolder[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saving, setSaving] = useState<YouTubeResult | null>(null);
  const [pending, startTransition] = useTransition();
  const currentId = usePlayerStore((s) => s.current?.externalId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    setStatus({ kind: "loading" });
    try {
      const response = await search(clean);
      setStatus({ kind: "done", response });
      if (response.userKeyProblem) {
        toast(userKeyProblemMessage(response.userKeyProblem), { tone: "warn" });
      }
    } catch (error) {
      setStatus({
        kind: "error",
        message: youtubeSearchErrorMessage(error instanceof Error ? error.message : "failed"),
      });
    }
  };

  const save = (folderId: string | null, folderName: string) => {
    const video = saving;
    if (!video) return;
    startTransition(async () => {
      const result = await saveYouTubeVideo(video, folderId);
      if (!result.ok) {
        toast(saveVideoErrorMessage(result.error), { tone: "error" });
        return;
      }
      setSaving(null);
      toast(
        result.alreadySaved
          ? SAVE_VIDEO_MESSAGES.moved(folderName)
          : SAVE_VIDEO_MESSAGES.saved(folderName),
        { tone: "success", durationMs: 2500 },
      );
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Buscar en YouTube</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Canciones, artistas, directos…"
            autoComplete="off"
            className="h-11 w-full rounded-2xl border border-transparent bg-surface-2 pr-4 pl-10 text-text outline-none placeholder:text-muted focus:border-secondary focus:ring-2 focus:ring-secondary/40"
          />
        </label>
        <button
          type="submit"
          disabled={!query.trim() || status.kind === "loading"}
          className="h-11 shrink-0 rounded-2xl bg-primary px-5 font-display font-semibold text-bg transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:opacity-60"
        >
          Buscar
        </button>
      </form>

      <div aria-live="polite">
        {status.kind === "idle" ? (
          <EmptyState title="Busca algo para escuchar">
            Los vídeos se ven en «Ahora suena». Puedes añadirlos a la cola o guardarlos en tus
            carpetas
          </EmptyState>
        ) : status.kind === "loading" ? (
          <LoadingCat label="Buscando en YouTube…" />
        ) : status.kind === "error" ? (
          <p role="alert" className="rounded-2xl border border-danger/50 bg-surface p-4 text-sm">
            {status.message}
          </p>
        ) : status.response.results.length === 0 ? (
          <EmptyState title="Nada por aquí">Prueba con otras palabras, nya~</EmptyState>
        ) : (
          <>
            {status.response.stale ? (
              <p className="mb-3 text-sm text-warn">
                No se pudo buscar ahora: te enseño resultados guardados de antes.
              </p>
            ) : null}
            <ol className="flex flex-col gap-1">
              {status.response.results.map((result) => {
                const track = resultToTrack(result);
                const isCurrent = currentId === result.videoId;
                return (
                  <li
                    key={result.videoId}
                    {...draggableProps({ kind: "track", id: track.id, track })}
                    className={`flex items-center gap-3 rounded-2xl p-2 transition hover:bg-surface ${
                      isCurrent ? "bg-primary/10" : ""
                    }`}
                  >
                    {/* ytimg.com thumbnails: next/image would need the domain configured. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.thumbnail}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="aspect-video w-28 shrink-0 rounded-xl bg-surface-2 object-cover @tablet:w-36"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`line-clamp-2 text-sm font-semibold ${isCurrent ? "text-primary" : ""}`}
                      >
                        {result.title}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {result.channel}
                        {result.durationS ? ` · ${formatTime(result.durationS)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col @tablet:flex-row">
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
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
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
