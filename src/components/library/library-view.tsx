"use client";

import {
  ChevronRight,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  Library,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useOptimistic, useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Folder, FolderTree } from "@/lib/ds/folder-tree";
import {
  createFolder,
  deleteFolder,
  type LibraryActionResult,
  moveFolder,
  moveTrack,
  renameFolder,
} from "@/lib/library/actions";
import {
  applyLibraryChange,
  buildFolderTree,
  canMoveFolder,
  type LibraryChange,
  type LibraryState,
} from "@/lib/library/folders";
import { folderErrorMessage } from "@/lib/library/messages";
import { buildLibraryIndex, suggest } from "@/lib/library/search";
import { toast } from "@/stores/toast-store";
import { type DragItem, draggableProps, useDropTarget } from "./dnd";
import { FolderDialog, type FolderDialogState } from "./folder-dialog";
import { TrackList } from "./track-list";
import { UploadDropzone } from "./upload-dropzone";
import { UploadList } from "./upload-list";

const SEARCH_LIMIT = 100;

/**
 * The library as a file explorer: breadcrumbs, subfolders and tracks of the
 * current folder (`?folder=<id>`). Folders and tracks can be dragged onto any
 * folder or breadcrumb. Changes show at once (optimistic) and are saved with
 * Server Actions; on error the view goes back to the real data.
 */
export function LibraryView(initial: LibraryState) {
  const [state, applyChange] = useOptimistic(initial, applyLibraryChange);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialog, setDialog] = useState<FolderDialogState | null>(null);
  const [query, setQuery] = useState("");
  const suggestionsId = useId();

  const tree = useMemo(() => buildFolderTree(state.folders), [state.folders]);
  const index = useMemo(
    () => buildLibraryIndex(state.tracks, state.folders),
    [state.tracks, state.folders],
  );

  const requested = searchParams.get("folder");
  const currentId = requested && tree.has(requested) ? requested : null;
  const open = (id: string | null) =>
    router.push(id ? `/library?folder=${id}` : "/library", { scroll: false });

  function run(change: LibraryChange, action: () => Promise<LibraryActionResult>) {
    setDialog(null);
    startTransition(async () => {
      applyChange(change);
      const result = await action();
      if (!result.ok) toast(folderErrorMessage(result.error), { tone: "error" });
    });
  }

  const handlers = {
    create(name: string, parentId: string | null) {
      const id = crypto.randomUUID();
      run({ type: "create-folder", folder: { id, name, parent_id: parentId } }, () =>
        createFolder(id, name, parentId),
      );
    },
    rename(id: string, name: string) {
      run({ type: "rename-folder", id, name }, () => renameFolder(id, name));
    },
    moveFolder(id: string, parentId: string | null) {
      if (!canMoveFolder(state.folders, id, parentId)) {
        setDialog(null);
        return;
      }
      run({ type: "move-folder", id, parentId }, () => moveFolder(id, parentId));
    },
    moveTrack(id: string, folderId: string | null) {
      run({ type: "move-track", id, folderId }, () => moveTrack(id, folderId));
    },
    delete(id: string) {
      // Leaving a folder that is about to disappear: go to its parent.
      if (currentId && tree.isDescendantOf(currentId, id)) open(tree.get(id)!.parentId);
      run({ type: "delete-folder", id }, () => deleteFolder(id));
    },
  };

  /** Drop of a dragged folder/track onto `target` (`null` = library root). */
  const dropOn = (target: string | null) => ({
    canDrop: (item: DragItem) =>
      item.kind === "folder"
        ? canMoveFolder(state.folders, item.id, target)
        : state.tracks.find((t) => t.id === item.id)?.folder_id !== target,
    onDrop: (item: DragItem) =>
      item.kind === "folder"
        ? handlers.moveFolder(item.id, target)
        : handlers.moveTrack(item.id, target),
  });

  const searching = query.trim().length > 0;
  const subfolders = searching
    ? index.folders
        .search(query, SEARCH_LIMIT)
        .map((id) => tree.get(id)!)
        .filter(Boolean)
    : tree.children(currentId);
  // Results keep the library order (newest first).
  const found = searching ? new Set(index.tracks.search(query, SEARCH_LIMIT)) : null;
  const tracks = state.tracks.filter((t) => (found ? found.has(t.id) : t.folder_id === currentId));
  const suggestions = searching ? suggest(index, query) : [];

  const trackCount = (folderIds: string[]) => {
    const ids = new Set(folderIds);
    return state.tracks.filter((t) => t.folder_id && ids.has(t.folder_id)).length;
  };

  return (
    <div className="flex flex-col gap-6">
      <UploadDropzone folderId={currentId} />
      <UploadList />

      <div className="flex flex-col gap-3 @tablet:flex-row @tablet:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar en tu biblioteca</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            list={suggestionsId}
            placeholder="Buscar canciones, artistas o carpetas…"
            autoComplete="off"
            className="h-11 w-full rounded-2xl border border-transparent bg-surface-2 pr-4 pl-10 text-text outline-none placeholder:text-muted/70 focus:border-secondary focus:ring-2 focus:ring-secondary/40"
          />
          <datalist id={suggestionsId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <button
          type="button"
          onClick={() => setDialog({ mode: "create", parentId: currentId })}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-surface-2 px-4 font-display font-semibold text-secondary transition hover:bg-secondary/15 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
        >
          <FolderPlus aria-hidden className="size-4" />
          Nueva carpeta
        </button>
      </div>

      {searching ? (
        <p className="px-1 text-sm text-muted" aria-live="polite">
          {tracks.length + subfolders.length === 0
            ? "Nada por aquí… prueba con otra palabra, nya~"
            : `${tracks.length} ${tracks.length === 1 ? "canción" : "canciones"} y ${subfolders.length} ${subfolders.length === 1 ? "carpeta" : "carpetas"} en toda la biblioteca`}
        </p>
      ) : (
        <Breadcrumbs tree={tree} currentId={currentId} onOpen={open} dropOn={dropOn} />
      )}

      {subfolders.length > 0 ? (
        <section aria-label="Carpetas">
          <ul className="grid grid-cols-1 gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3">
            {subfolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                count={trackCount([folder.id])}
                onOpen={() => {
                  setQuery("");
                  open(folder.id);
                }}
                onRename={() => setDialog({ mode: "rename", folder })}
                onMove={() => setDialog({ mode: "move-folder", folder })}
                onDelete={() => setDialog({ mode: "delete", folder })}
                dropOn={dropOn}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {tracks.length > 0 ? (
        <section aria-label="Canciones">
          <h2 className="mb-2 px-3 text-xs font-semibold tracking-wide text-muted uppercase">
            {tracks.length} {tracks.length === 1 ? "canción" : "canciones"}
          </h2>
          <TrackList tracks={tracks} onMove={(track) => setDialog({ mode: "move-track", track })} />
        </section>
      ) : !searching && subfolders.length === 0 ? (
        currentId ? (
          <EmptyState title="Esta carpeta está vacía">
            Arrastra canciones aquí o sube nuevas, nya~
          </EmptyState>
        ) : (
          <EmptyState title="Tu biblioteca está vacía">
            Sube tu primera canción y aparecerá aquí, nya~
          </EmptyState>
        )
      ) : null}

      <FolderDialog
        state={dialog}
        tree={tree}
        trackCount={trackCount}
        onClose={() => setDialog(null)}
        onCreate={handlers.create}
        onRename={handlers.rename}
        onMoveFolder={handlers.moveFolder}
        onMoveTrack={handlers.moveTrack}
        onDelete={handlers.delete}
      />
    </div>
  );
}

type DropOn = (target: string | null) => {
  canDrop: (item: DragItem) => boolean;
  onDrop: (item: DragItem) => void;
};

function Breadcrumbs({
  tree,
  currentId,
  onOpen,
  dropOn,
}: {
  tree: FolderTree;
  currentId: string | null;
  onOpen: (id: string | null) => void;
  dropOn: DropOn;
}) {
  const path = currentId ? tree.path(currentId) : [];
  return (
    <nav aria-label="Ruta de carpetas">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        <Crumb
          id={null}
          name="Biblioteca"
          isLast={path.length === 0}
          onOpen={onOpen}
          dropOn={dropOn}
        />
        {path.map((folder, i) => (
          <Crumb
            key={folder.id}
            id={folder.id}
            name={folder.name}
            isLast={i === path.length - 1}
            onOpen={onOpen}
            dropOn={dropOn}
          />
        ))}
      </ol>
    </nav>
  );
}

function Crumb({
  id,
  name,
  isLast,
  onOpen,
  dropOn,
}: {
  id: string | null;
  name: string;
  isLast: boolean;
  onOpen: (id: string | null) => void;
  dropOn: DropOn;
}) {
  const { canDrop, onDrop } = dropOn(id);
  const drop = useDropTarget(onDrop, canDrop);
  return (
    <li className="flex min-w-0 items-center gap-1">
      {id !== null ? <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" /> : null}
      <button
        type="button"
        onClick={() => onOpen(id)}
        aria-current={isLast ? "page" : undefined}
        {...drop.props}
        className={`flex max-w-48 items-center gap-1.5 truncate rounded-xl px-2.5 py-1.5 transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none aria-[current=page]:font-semibold aria-[current=page]:text-text ${
          drop.over ? "bg-secondary/20 ring-2 ring-secondary" : "text-muted"
        }`}
      >
        {id === null ? <Library aria-hidden className="size-4 shrink-0" /> : null}
        <span className="truncate">{name}</span>
      </button>
    </li>
  );
}

function FolderCard({
  folder,
  count,
  onOpen,
  onRename,
  onMove,
  onDelete,
  dropOn,
}: {
  folder: Folder;
  count: number;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  dropOn: DropOn;
}) {
  const { canDrop, onDrop } = dropOn(folder.id);
  const drop = useDropTarget(onDrop, canDrop);
  const action =
    "flex size-8 shrink-0 items-center justify-center rounded-xl text-muted opacity-60 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-text focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none";

  return (
    <li
      {...draggableProps({ kind: "folder", id: folder.id })}
      {...drop.props}
      className={`group flex items-center gap-1 rounded-2xl bg-surface pr-1 transition ${
        drop.over ? "bg-secondary/15 ring-2 ring-secondary" : "hover:bg-surface-2/60"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        <FolderIcon aria-hidden className="size-5 shrink-0 text-secondary" />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{folder.name}</span>
          <span className="block text-xs text-muted">
            {count} {count === 1 ? "canción" : "canciones"}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onRename}
        aria-label={`Renombrar ${folder.name}`}
        title="Renombrar"
        className={action}
      >
        <Pencil aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        onClick={onMove}
        aria-label={`Mover ${folder.name}`}
        title="Mover"
        className={action}
      >
        <FolderInput aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Borrar ${folder.name}`}
        title="Borrar"
        className={`${action} hover:text-danger`}
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
    </li>
  );
}
