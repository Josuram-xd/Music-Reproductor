"use client";

import { X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { MAX_PLAYLIST_NAME, validatePlaylistName } from "@/lib/playlists/playlists";

export type PlaylistDialogState =
  | {
      mode: "create";
      /** Overrides for other "name it" flows (e.g. saving the queue). */
      title?: string;
      description?: ReactNode;
      submitLabel?: string;
    }
  | { mode: "rename"; playlist: { id: string; name: string } }
  | { mode: "delete"; playlist: { id: string; name: string } };

interface PlaylistDialogProps {
  state: PlaylistDialogState | null;
  onClose: () => void;
  onCreate?: (name: string) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
}

const TITLES = {
  create: "Nueva playlist",
  rename: "Renombrar playlist",
  delete: "Borrar playlist",
};

/** Modal (native `<dialog>`) to name, rename or delete a playlist. */
export function PlaylistDialog({ state, onClose, ...actions }: PlaylistDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state && !dialog.open) dialog.showModal();
    if (!state && dialog.open) dialog.close();
  }, [state]);

  const title = state ? (state.mode === "create" && state.title) || TITLES[state.mode] : "";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border-2 border-surface-2 bg-surface p-0 text-text shadow-pixel backdrop:bg-bg/60 backdrop:backdrop-blur-sm"
    >
      {state ? (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id={titleId} className="font-display text-xl font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          {state.mode === "delete" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                ¿Borrar <strong className="text-text">{state.playlist.name}</strong>? Sus canciones
                se quedan en tu biblioteca, solo desaparece la lista
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  autoFocus
                  onClick={() => actions.onDelete?.(state.playlist.id)}
                  className="bg-danger! shadow-none!"
                >
                  Borrar
                </Button>
              </div>
            </div>
          ) : (
            <>
              {state.mode === "create" && state.description ? (
                <p className="text-sm text-muted">{state.description}</p>
              ) : null}
              {/* Keyed so each playlist starts with fresh form state. */}
              <NameForm
                key={state.mode === "rename" ? state.playlist.id : "create"}
                initial={state.mode === "rename" ? state.playlist.name : ""}
                submitLabel={state.mode === "rename" ? "Guardar" : (state.submitLabel ?? "Crear")}
                onCancel={onClose}
                onSubmit={(name) =>
                  state.mode === "rename"
                    ? actions.onRename?.(state.playlist.id, name)
                    : actions.onCreate?.(name)
                }
              />
            </>
          )}
        </div>
      ) : null}
    </dialog>
  );
}

function NameForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = validatePlaylistName(name);
    if (!clean) {
      setError("Ponle un nombre (máximo 100 caracteres)");
      return;
    }
    onSubmit(clean);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        name="playlist-name"
        label="Nombre"
        value={name}
        maxLength={MAX_PLAYLIST_NAME}
        autoFocus
        autoComplete="off"
        placeholder="Para estudiar"
        error={error}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
