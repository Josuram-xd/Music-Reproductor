"use client";

import {
  LoaderCircle,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatTime } from "@/lib/player/format";
import { REPEAT_LABELS } from "@/lib/player/messages";
import { SEEK_STEP_S } from "@/lib/player/player-engine";
import { player, usePlayerStore } from "@/stores/player-store";

function IconButton({
  label,
  onClick,
  disabled,
  pressed,
  big = false,
  className = "",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  big?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center justify-center rounded-full transition focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        big
          ? "size-12 bg-primary text-bg shadow-[0_0_24px_-6px_var(--primary)] hover:brightness-110"
          : "size-11 text-muted hover:bg-surface-2 hover:text-text aria-pressed:text-primary"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Fixed player bar (the "classic bar"; the floating mini-player comes in E8).
 * ⏮ uses the double back; ±10 s, progress and volume act on the engine.
 */
export function PlayerBar() {
  const current = usePlayerStore((s) => s.current);
  const state = usePlayerStore((s) => s.state);
  const time = usePlayerStore((s) => s.time);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const repeat = usePlayerStore((s) => s.repeat);
  const hasNext = usePlayerStore((s) => s.hasNext);
  const queueLength = usePlayerStore((s) => s.queue.length);

  const empty = !current && queueLength === 0;
  const playing = state === "playing";
  const loading = state === "loading";
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  return (
    <section
      aria-label="Reproductor"
      className="shrink-0 border-t border-surface-2 bg-surface/95 px-3 py-2 backdrop-blur @tablet:px-4"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 @desktop:w-60 @desktop:flex-none">
          <p className="truncate text-sm font-semibold">{current?.title ?? "Nada sonando, nya~"}</p>
          <p className="truncate text-xs text-muted">
            {current ? (current.artist ?? "Artista desconocido") : "Elige una canción 🐾"}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 @desktop:flex-1">
          <div className="flex items-center gap-1">
            <IconButton
              label={REPEAT_LABELS[repeat]}
              onClick={player.cycleRepeat}
              pressed={repeat !== "off"}
              className="hidden @tablet:flex"
            >
              <RepeatIcon aria-hidden className="size-5" />
            </IconButton>
            <IconButton
              label={`Retroceder ${SEEK_STEP_S} s`}
              onClick={() => player.seekBy(-SEEK_STEP_S)}
              disabled={!current}
              className="hidden text-xs font-bold @tablet:flex"
            >
              −10
            </IconButton>
            <IconButton label="Anterior" onClick={() => void player.back()} disabled={!current}>
              <SkipBack aria-hidden className="size-5" />
            </IconButton>
            <IconButton
              big
              label={playing ? "Pausar" : "Reproducir"}
              onClick={player.toggle}
              disabled={empty}
            >
              {loading ? (
                <LoaderCircle
                  aria-hidden
                  className="size-6 animate-spin motion-reduce:animate-none"
                />
              ) : playing ? (
                <Pause aria-hidden className="size-6" />
              ) : (
                <Play aria-hidden className="ml-0.5 size-6" />
              )}
            </IconButton>
            <IconButton label="Siguiente" onClick={player.next} disabled={!hasNext}>
              <SkipForward aria-hidden className="size-5" />
            </IconButton>
            <IconButton
              label={`Adelantar ${SEEK_STEP_S} s`}
              onClick={() => player.seekBy(SEEK_STEP_S)}
              disabled={!current}
              className="hidden text-xs font-bold @tablet:flex"
            >
              +10
            </IconButton>
          </div>

          <div className="hidden w-full max-w-xl items-center gap-2 text-xs text-muted tabular-nums @tablet:flex">
            <span className="w-10 text-right">{formatTime(time)}</span>
            <input
              type="range"
              aria-label="Progreso"
              aria-valuetext={`${formatTime(time)} de ${formatTime(duration)}`}
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(time, duration || 1)}
              disabled={!current || duration === 0}
              onChange={(event) => player.seek(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed"
            />
            <span className="w-10">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="hidden w-60 items-center justify-end gap-1 @desktop:flex">
          <IconButton
            label={muted ? "Activar sonido" : "Silenciar"}
            onClick={player.toggleMute}
            pressed={muted}
          >
            <VolumeIcon aria-hidden className="size-5" />
          </IconButton>
          <input
            type="range"
            aria-label="Volumen"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(event) => player.setVolume(Number(event.target.value))}
            className="h-1.5 w-28 cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* Mobile: thin progress line instead of the slider. */}
      <div
        aria-hidden
        className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2 @tablet:hidden"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${duration > 0 ? (time / duration) * 100 : 0}%` }}
        />
      </div>
    </section>
  );
}
