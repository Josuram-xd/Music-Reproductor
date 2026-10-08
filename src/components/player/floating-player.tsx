"use client";

import {
  ChevronDown,
  LoaderCircle,
  Music,
  PawPrint,
  Pause,
  PictureInPicture2,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { openDocumentPip, supportsDocumentPip } from "@/lib/player/document-pip";
import {
  type Area,
  AVOID_ATTR,
  type AvoidSide,
  freeArea,
  nudge,
  type Point,
  type Size,
  snapToEdge,
  toPixels,
} from "@/lib/player/floating-position";
import { formatTime } from "@/lib/player/format";
import { FLOATING_MESSAGES } from "@/lib/player/messages";
import { progressStyle } from "@/lib/player/progress";
import { player, usePlayerStore } from "@/stores/player-store";
import { settings, useSettingsStore } from "@/stores/settings-store";
import { toast } from "@/stores/toast-store";
import { MiniPlayerPill, useNarrow } from "./floating-pill";
import { useTouchAwake } from "./use-touch-awake";
import { PixelEars } from "@/components/ui/pixel/pixel";

function RoundButton({
  label,
  onClick,
  disabled,
  big = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center justify-center rounded-full transition focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        big
          ? "size-11 bg-primary text-bg shadow-pixel-primary hover:brightness-110"
          : "size-10 text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/** Cover, title, time, progress and ⏮ ⏯ ⏭: the content of the mini-player. */
export function MiniPlayerContent() {
  const current = usePlayerStore((s) => s.current);
  const state = usePlayerStore((s) => s.state);
  const time = usePlayerStore((s) => s.time);
  const duration = usePlayerStore((s) => s.duration);
  const hasNext = usePlayerStore((s) => s.hasNext);
  const queueLength = usePlayerStore((s) => s.queue.length);
  const playing = state === "playing";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-2 text-secondary">
          {current?.coverUrl ? (
            // Signed / third-party image URLs: next/image would need their domains.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.coverUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <Music aria-hidden className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{current?.title ?? "Nada sonando, nya~"}</p>
          <p className="truncate text-xs text-muted">
            {current ? (current.artist ?? "Artista desconocido") : "Elige una canción"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[0.7rem] text-muted tabular-nums">
        <input
          type="range"
          aria-label="Progreso"
          aria-valuetext={`${formatTime(time)} de ${formatTime(duration)}`}
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(time, duration || 1)}
          style={progressStyle(time, duration)}
          disabled={!current || duration === 0}
          onChange={(event) => player.seek(Number(event.target.value))}
          className="paw-slider flex-1"
        />
        <span>
          {formatTime(time)} / {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <RoundButton label="Anterior" onClick={() => void player.back()} disabled={!current}>
          <SkipBack aria-hidden className="size-5" />
        </RoundButton>
        <RoundButton
          big
          label={playing ? "Pausar" : "Reproducir"}
          onClick={player.toggle}
          disabled={!current && queueLength === 0}
        >
          {state === "loading" ? (
            <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
          ) : playing ? (
            <Pause aria-hidden className="size-5" />
          ) : (
            <Play aria-hidden className="ml-0.5 size-5" />
          )}
        </RoundButton>
        <RoundButton label="Siguiente" onClick={player.next} disabled={!hasNext}>
          <SkipForward aria-hidden className="size-5" />
        </RoundButton>
      </div>
    </div>
  );
}

const TOOL_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none";

const noop = () => () => {};

/** Measures the free area (not over header, queue or tabs) and the widget size. */
function useLayout(ref: RefObject<HTMLElement | null>, active: boolean) {
  const [layout, setLayout] = useState<{ area: Area; size: Size } | null>(null);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const avoid = [...document.querySelectorAll<HTMLElement>(`[${AVOID_ATTR}]`)].map((node) => ({
      side: node.getAttribute(AVOID_ATTR) as AvoidSide,
      rect: node.getBoundingClientRect(),
    }));
    setLayout({
      area: freeArea({ width: window.innerWidth, height: window.innerHeight }, avoid),
      size: { width: element.offsetWidth, height: element.offsetHeight },
    });
  }, [ref]);

  useLayoutEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener("resize", measure);
    // The widget's own size, and layout parts that come and go with the width.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (ref.current) observer?.observe(ref.current);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [active, measure, ref]);

  return layout;
}

/**
 * Floating mini-player (replaces the fixed bar while enabled).
 * - 50 % opaque at rest; fully opaque on hover, keyboard focus, or for 4 s
 *   after a touch; blurred background so it reads over anything.
 * - Dragged by the paw handle (or its arrow keys), it sticks to the nearest
 *   side edge and remembers where; it never covers the queue, header or tabs
 *   and stays on screen when the window is resized.
 * - ✕ turns it off (back to the fixed bar); ⧉ takes it out of the window
 *   (Document Picture-in-Picture) where supported.
 * - On phones it folds into a pill (cover + ⏯) that opens on tap and folds
 *   back when tapping elsewhere.
 */
export function FloatingPlayer() {
  const { awake, onPointerDown } = useTouchAwake();
  const saved = useSettingsStore((s) => s.floatingPos);
  const ref = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState<{ point: Point; offset: Point } | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipSupported = useSyncExternalStore(
    noop,
    () => supportsDocumentPip(),
    () => false,
  );
  const narrow = useNarrow();
  const [expanded, setExpanded] = useState(false);
  const compact = narrow && !expanded;
  const layout = useLayout(ref, pipWindow === null);

  // An open card on a phone folds back into the pill when tapping elsewhere.
  useEffect(() => {
    if (!narrow || !expanded) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [narrow, expanded]);

  // Leaving the app (or turning the widget off) closes the PiP window too.
  useEffect(() => () => pipWindow?.close(), [pipWindow]);

  const point = drag?.point ?? (layout ? toPixels(saved, layout.size, layout.area) : null);

  const handle = {
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (!point || event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDrag({ point, offset: { x: event.clientX - point.x, y: event.clientY - point.y } });
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      if (!drag) return;
      setDrag({
        ...drag,
        point: { x: event.clientX - drag.offset.x, y: event.clientY - drag.offset.y },
      });
    },
    onPointerUp() {
      if (!drag || !layout) return setDrag(null);
      const position = snapToEdge(drag.point, layout.size, layout.area);
      setDrag(null);
      void settings.update({ floatingPos: position });
    },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      const next = nudge(saved, event.key);
      if (!next) return;
      event.preventDefault();
      void settings.update({ floatingPos: next });
    },
  };

  const close = async () => {
    if (await settings.update({ floatingPlayer: false })) toast(FLOATING_MESSAGES.closed);
  };

  const openPip = async () => {
    try {
      const pip = await openDocumentPip();
      pip.addEventListener("pagehide", () => setPipWindow(null), { once: true });
      setPipWindow(pip);
    } catch {
      toast(FLOATING_MESSAGES.pipFailed, { tone: "warn" });
    }
  };

  if (pipWindow) {
    return (
      <>
        {createPortal(
          <section aria-label="Mini-reproductor" className="min-h-dvh bg-surface p-3 text-text">
            <MiniPlayerContent />
          </section>,
          pipWindow.document.body,
        )}
        <button
          type="button"
          onClick={() => pipWindow.close()}
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-10 items-center gap-2 rounded-full border border-surface-2 bg-surface/90 px-4 text-sm font-semibold text-muted shadow-lg backdrop-blur hover:text-text @tablet:bottom-4"
        >
          <PictureInPicture2 aria-hidden className="size-4" />
          Traer el reproductor de vuelta
        </button>
      </>
    );
  }

  return (
    <section
      ref={ref}
      aria-label="Mini-reproductor"
      data-awake={awake || undefined}
      data-dragging={drag ? "" : undefined}
      data-compact={compact || undefined}
      onPointerDown={onPointerDown}
      style={
        point ? { left: point.x, top: point.y } : { right: 16, bottom: 16, visibility: "hidden" }
      }
      className="fixed z-30 w-72 border-2 border-surface-2 bg-surface/90 p-3 opacity-50 shadow-pixel backdrop-blur-md transition-[opacity,left,top] duration-300 focus-within:opacity-100 hover:opacity-100 data-awake:opacity-100 data-compact:w-auto data-compact:rounded-full data-compact:p-1.5 data-dragging:opacity-100 data-dragging:transition-none motion-reduce:transition-none"
    >
      <PixelEars className="absolute -top-3 left-4" />
      <div className={compact ? "flex items-center gap-1" : "-mt-1 mb-1 flex items-center gap-1"}>
        <button
          type="button"
          aria-label="Mover el mini-reproductor (o usa las flechas)"
          title="Arrastra para moverlo"
          {...handle}
          className={`${TOOL_BUTTON} cursor-grab touch-none active:cursor-grabbing`}
        >
          <PawPrint aria-hidden className="size-4" />
        </button>
        {compact ? (
          <MiniPlayerPill onExpand={() => setExpanded(true)} />
        ) : (
          <>
            <span className="flex-1" />
            {narrow ? (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Plegar el mini-reproductor"
                title="Plegar"
                className={TOOL_BUTTON}
              >
                <ChevronDown aria-hidden className="size-4" />
              </button>
            ) : null}
            {pipSupported ? (
              <button
                type="button"
                onClick={() => void openPip()}
                aria-label="Sacar de la ventana"
                title="Sacar de la ventana (encima de otras apps)"
                className={TOOL_BUTTON}
              >
                <PictureInPicture2 aria-hidden className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void close()}
              aria-label="Ocultar el mini-reproductor"
              title="Ocultar (vuelve la barra fija)"
              className={TOOL_BUTTON}
            >
              <X aria-hidden className="size-4" />
            </button>
          </>
        )}
      </div>
      {compact ? null : <MiniPlayerContent />}
    </section>
  );
}
