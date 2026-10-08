"use client";

import { Folder as FolderIcon, Library, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildFolderTree, type LibraryFolder } from "@/lib/library/folders";

const ROOT = "root";

interface SaveToFolderDialogProps {
  /** Title of the video being saved, or `null` when closed. */
  title: string | null;
  folders: LibraryFolder[];
  pending?: boolean;
  onClose: () => void;
  /** `folderId = null` is the library root. */
  onSave: (folderId: string | null, folderName: string) => void;
}

/** Picks the library folder a YouTube video is saved to. */
export function SaveToFolderDialog({
  title,
  folders,
  pending = false,
  onClose,
  onSave,
}: SaveToFolderDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState(ROOT);
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (title !== null && !dialog.open) dialog.showModal();
    if (title === null && dialog.open) dialog.close();
  }, [title]);

  const options = [
    { id: ROOT, name: "Biblioteca (sin carpeta)", depth: 0 },
    ...[...tree.traverse()].map(({ folder, depth }) => ({
      id: folder.id,
      name: folder.name,
      depth: depth + 1,
    })),
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const option = options.find((o) => o.id === target) ?? options[0]!;
    onSave(
      option.id === ROOT ? null : option.id,
      option.id === ROOT ? "tu biblioteca" : `«${option.name}»`,
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        setTarget(ROOT);
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl bg-surface p-0 text-text shadow-[0_0_40px_-12px_var(--primary)] backdrop:bg-bg/60 backdrop:backdrop-blur-sm"
    >
      {title !== null ? (
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-xl font-semibold">
                Guardar en la biblioteca
              </h2>
              <p className="truncate text-sm text-muted">{title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <fieldset className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-2xl bg-bg/40 p-2">
            <legend className="sr-only">Carpeta</legend>
            {options.map((option) => {
              const Icon = option.id === ROOT ? Library : FolderIcon;
              return (
                <label
                  key={option.id}
                  style={{ paddingLeft: `${0.75 + option.depth}rem` }}
                  className="flex cursor-pointer items-center gap-2 rounded-xl py-2 pr-3 text-sm hover:bg-surface-2 has-checked:bg-secondary/15 has-checked:text-secondary"
                >
                  <input
                    type="radio"
                    name="folder"
                    value={option.id}
                    checked={target === option.id}
                    onChange={() => setTarget(option.id)}
                    className="sr-only"
                  />
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{option.name}</span>
                </label>
              );
            })}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" pending={pending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
