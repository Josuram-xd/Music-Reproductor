"use client";

import { ListStart, Play, Undo2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { DropChoice } from "@/lib/player/queue-commands";
import { usePlayerStore } from "@/stores/player-store";
import { queue, useQueueStore } from "@/stores/queue-store";

/**
 * Asks what to do with a track dropped on top of the one playing
 * (docs/ARCHITECTURE.md). Esc or a click outside counts as "Fue un error",
 * the safe option, which also has the initial focus.
 */
export function DropChoiceDialog() {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pending = useQueueStore((s) => s.pendingDrop);
  const currentTitle = usePlayerStore((s) => s.current?.title);
  const [remember, setRemember] = useState(false);

  useEffect(() => queue.syncPreference(), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  const choose = (choice: DropChoice) => queue.resolveDrop(choice, { remember });
  const revert = () => queue.resolveDrop("revert");

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Esc closes the native dialog; closing after a choice reverts nothing.
      onClose={() => {
        setRemember(false);
        revert();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) revert();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border-2 border-surface-2 bg-surface p-0 text-text shadow-pixel backdrop:bg-bg/60 backdrop:backdrop-blur-sm"
    >
      {pending ? (
        <div className="flex flex-col gap-4 p-5">
          <div>
            <h2 id={titleId} className="font-display text-xl font-semibold">
              ¿Qué hago con esta canción?
            </h2>
            <p className="mt-1 truncate text-sm text-muted">
              Has soltado <strong className="text-text">{pending.track.title}</strong> encima de la
              que suena.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <ChoiceButton
              onClick={() => choose("playNow")}
              icon={<Play aria-hidden className="size-5" />}
              title="Reproducir ahora"
              tone="warn"
            >
              Se corta «{currentTitle}» y empieza la que has soltado.
            </ChoiceButton>
            <ChoiceButton
              onClick={revert}
              icon={<Undo2 aria-hidden className="size-5" />}
              title="Fue un error"
              autoFocus
            >
              Vuelve a donde estaba, sin cambios.
            </ChoiceButton>
            <ChoiceButton
              onClick={() => choose("playNext")}
              icon={<ListStart aria-hidden className="size-5" />}
              title="Ponerla a continuación"
            >
              Sonará justo después de la actual.
            </ChoiceButton>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl px-1 text-sm text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              No volver a preguntar en esta sesión
              <span className="block text-xs text-muted">
                Se aplica a «Reproducir ahora» y «A continuación». Puedes reactivarlo en Ajustes.
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </dialog>
  );
}

function ChoiceButton({
  title,
  icon,
  tone,
  children,
  ...button
}: {
  title: string;
  icon: ReactNode;
  tone?: "warn";
  children: ReactNode;
  onClick: () => void;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      {...button}
      className={`flex items-start gap-3 rounded-2xl border bg-surface-2/40 p-3 text-left transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none ${
        tone === "warn" ? "border-warn/50" : "border-surface-2"
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${tone === "warn" ? "text-warn" : "text-secondary"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-display font-semibold">{title}</span>
        <span className="block text-sm text-muted">{children}</span>
      </span>
    </button>
  );
}
