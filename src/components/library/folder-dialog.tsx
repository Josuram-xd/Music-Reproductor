"use client";

import { Folder as FolderIcon, Library, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { Folder, FolderTree } from "@/lib/ds/folder-tree";
import { MAX_FOLDER_NAME, validateFolderName } from "@/lib/library/folders";
import type { LibraryTrack } from "@/lib/library/tracks";

export type FolderDialogState =
  | { mode: "create"; parentId: string | null }
  | { mode: "rename"; folder: Folder }
  | { mode: "move-folder"; folder: Folder }
  | { mode: "move-track"; track: LibraryTrack }
  | { mode: "delete"; folder: Folder };

interface FolderDialogProps {
  state: FolderDialogState | null;
  tree: FolderTree;
  /** Number of tracks per folder id, to warn before deleting. */
  trackCount: (folderIds: string[]) => number;
  onClose: () => void;
  onCreate: (name: string, parentId: string | null) => void;
  onRename: (id: string, name: string) => void;
  onMoveFolder: (id: string, parentId: string | null) => void;
  onMoveTrack: (id: string, folderId: string | null) => void;
  onDelete: (id: string) => void;
}

const ROOT = "root";

const TITLES: Record<FolderDialogState["mode"], string> = {
  create: "Nueva carpeta",
  rename: "Renombrar carpeta",
  "move-folder": "Mover carpeta",
  "move-track": "Mover canción",
  delete: "Borrar carpeta",
};

/** Modal (native `<dialog>`) for every folder action that needs input or confirmation. */
export function FolderDialog(props: FolderDialogProps) {
  const { state, onClose } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state && !dialog.open) dialog.showModal();
    if (!state && dialog.open) dialog.close();
  }, [state]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="folder-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl bg-surface p-0 text-text shadow-[0_0_40px_-12px_var(--primary)] backdrop:bg-bg/60 backdrop:backdrop-blur-sm"
    >
      {state ? (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="folder-dialog-title" className="font-display text-xl font-semibold">
              {TITLES[state.mode]}
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
          {/* Keyed so each opening starts with fresh form state. */}
          <DialogBody key={JSON.stringify(state)} {...props} state={state} />
        </div>
      ) : null}
    </dialog>
  );
}

function DialogBody(props: FolderDialogProps & { state: FolderDialogState }) {
  const { state } = props;
  switch (state.mode) {
    case "create":
      return (
        <NameForm
          initial=""
          submitLabel="Crear"
          onCancel={props.onClose}
          onSubmit={(name) => props.onCreate(name, state.parentId)}
        />
      );
    case "rename":
      return (
        <NameForm
          initial={state.folder.name}
          submitLabel="Guardar"
          onCancel={props.onClose}
          onSubmit={(name) => props.onRename(state.folder.id, name)}
        />
      );
    case "move-folder":
    case "move-track":
      return <MoveForm {...props} state={state} />;
    case "delete":
      return <DeleteConfirm {...props} folder={state.folder} />;
  }
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
    const clean = validateFolderName(name);
    if (!clean) {
      setError("Ponle un nombre (máximo 100 caracteres)");
      return;
    }
    onSubmit(clean);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        name="folder-name"
        label="Nombre"
        value={name}
        maxLength={MAX_FOLDER_NAME}
        autoFocus
        autoComplete="off"
        placeholder="Mis favoritas 🐾"
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

function MoveForm({
  state,
  tree,
  onClose,
  onMoveFolder,
  onMoveTrack,
}: FolderDialogProps & { state: Extract<FolderDialogState, { mode: `move-${string}` }> }) {
  const movingFolder = state.mode === "move-folder" ? state.folder : null;
  const movingTrack = state.mode === "move-track" ? state.track : null;
  const currentParent = movingFolder ? movingFolder.parentId : (movingTrack?.folder_id ?? null);
  const [target, setTarget] = useState<string | null>(null);

  // A folder cannot go inside itself or its descendants.
  const disabled = (id: string) =>
    movingFolder !== null && tree.isDescendantOf(id, movingFolder.id);

  const options: { id: string | null; name: string; depth: number }[] = [
    { id: null, name: "Biblioteca (sin carpeta)", depth: 0 },
    ...[...tree.traverse()].map(({ folder, depth }) => ({
      id: folder.id,
      name: folder.name,
      depth: depth + 1,
    })),
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = target === ROOT ? null : target;
    if (target === null || value === currentParent) return;
    if (movingFolder) onMoveFolder(movingFolder.id, value);
    else if (movingTrack) onMoveTrack(movingTrack.id, value);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="truncate text-sm text-muted">
        ¿A dónde va{" "}
        <strong className="text-text">{movingFolder?.name ?? movingTrack?.title}</strong>?
      </p>
      <fieldset className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-2xl bg-bg/40 p-2">
        <legend className="sr-only">Destino</legend>
        {options.map((option) => {
          const value = option.id ?? ROOT;
          const isCurrent = option.id === currentParent;
          const isDisabled = (option.id !== null && disabled(option.id)) || isCurrent;
          const Icon = option.id === null ? Library : FolderIcon;
          return (
            <label
              key={value}
              style={{ paddingLeft: `${0.75 + option.depth * 1}rem` }}
              className="flex cursor-pointer items-center gap-2 rounded-xl py-2 pr-3 text-sm hover:bg-surface-2 has-checked:bg-secondary/15 has-checked:text-secondary has-disabled:cursor-not-allowed has-disabled:opacity-50"
            >
              <input
                type="radio"
                name="target"
                value={value}
                disabled={isDisabled}
                checked={target === value}
                onChange={() => setTarget(value)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{option.name}</span>
              {isCurrent ? <span className="ml-auto text-xs text-muted">(aquí está)</span> : null}
            </label>
          );
        })}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={target === null}>
          Mover
        </Button>
      </div>
    </form>
  );
}

function DeleteConfirm({
  folder,
  tree,
  trackCount,
  onClose,
  onDelete,
}: FolderDialogProps & { folder: Folder }) {
  const ids = [...tree.traverse(folder.id)].map((entry) => entry.folder.id);
  const subfolders = ids.length - 1;
  const tracks = trackCount(ids);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        ¿Borrar <strong className="text-text">{folder.name}</strong>
        {subfolders > 0
          ? ` y ${subfolders === 1 ? "su subcarpeta" : `sus ${subfolders} subcarpetas`}`
          : ""}
        ?{" "}
        {tracks > 0
          ? `${tracks === 1 ? "La canción que tiene vuelve" : `Las ${tracks} canciones que tiene vuelven`} a la biblioteca, no se borra${tracks === 1 ? "" : "n"} 🐾`
          : "Está vacía."}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          autoFocus
          onClick={() => onDelete(folder.id)}
          className="bg-danger! shadow-none!"
        >
          Borrar
        </Button>
      </div>
    </div>
  );
}
