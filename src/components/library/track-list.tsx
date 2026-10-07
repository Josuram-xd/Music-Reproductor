"use client";

import { AudioLines, Film, FolderInput, Play } from "lucide-react";
import { type LibraryTrack, toPlayerTrack } from "@/lib/library/tracks";
import { formatTime } from "@/lib/player/format";
import { getPlayer, usePlayerStore } from "@/stores/player-store";
import { draggableProps } from "./dnd";

interface TrackListProps {
  tracks: LibraryTrack[];
  /** Shows a "move to folder" button; tracks can also be dragged onto a folder. */
  onMove?: (track: LibraryTrack) => void;
}

/** The library's tracks. Clicking one plays the whole list from there. */
export function TrackList({ tracks, onMove }: TrackListProps) {
  const currentId = usePlayerStore((s) => s.current?.id);
  const playing = usePlayerStore((s) => s.state === "playing");

  const play = (id: string) => {
    void getPlayer().setQueue(tracks.map(toPlayerTrack), { startId: id });
  };

  return (
    <ol className="flex flex-col gap-1">
      {tracks.map((track) => {
        const isCurrent = track.id === currentId;
        return (
          <li
            key={track.id}
            className="group flex items-center gap-1 rounded-2xl transition hover:bg-surface has-aria-[current=true]:bg-primary/10"
            {...(onMove ? draggableProps({ kind: "track", id: track.id }) : {})}
          >
            <button
              type="button"
              onClick={() => play(track.id)}
              aria-current={isCurrent ? "true" : undefined}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
            >
              <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-secondary">
                {track.cover_url ? (
                  // Signed URL of a private bucket: next/image would need its domain configured.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.cover_url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : null}
                <span
                  className={`relative flex size-full items-center justify-center ${
                    track.cover_url
                      ? `bg-bg/50 ${isCurrent && playing ? "" : "opacity-0 group-hover:opacity-100"}`
                      : ""
                  }`}
                >
                  {isCurrent && playing ? (
                    <AudioLines
                      aria-hidden
                      className="size-5 text-primary motion-safe:animate-pulse"
                    />
                  ) : (
                    <Play aria-hidden className="size-4 opacity-60 group-hover:opacity-100" />
                  )}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${isCurrent ? "text-primary" : ""}`}>
                  {track.title}
                </span>
                <span className="flex items-center gap-1.5 truncate text-sm text-muted">
                  {track.origin === "video" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 text-xs text-secondary">
                      <Film aria-hidden className="size-3" /> de vídeo
                    </span>
                  ) : null}
                  {track.artist ?? "Artista desconocido"}
                </span>
              </span>
              <span className="shrink-0 text-sm text-muted tabular-nums">
                {track.duration_s !== null ? formatTime(Number(track.duration_s)) : ""}
              </span>
            </button>
            {onMove ? (
              <button
                type="button"
                onClick={() => onMove(track)}
                aria-label={`Mover ${track.title} a una carpeta`}
                title="Mover a una carpeta"
                className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-xl text-muted opacity-60 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-text focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
              >
                <FolderInput aria-hidden className="size-4" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
