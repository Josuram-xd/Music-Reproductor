import { type Folder, FolderTree } from "@/lib/ds/folder-tree";
import type { FolderRow } from "@/lib/supabase/database.types";
import type { LibraryTrack } from "./tracks";

/** Columns the app reads from `folders`. */
export const FOLDER_COLUMNS = "id, parent_id, name";

export type LibraryFolder = Pick<FolderRow, "id" | "parent_id" | "name">;

export const MAX_FOLDER_NAME = 100;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trimmed name with collapsed spaces, or `null` if it is empty or too long. */
export function validateFolderName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const clean = name.replace(/\s+/g, " ").trim();
  return clean.length >= 1 && clean.length <= MAX_FOLDER_NAME ? clean : null;
}

const byName = (a: LibraryFolder, b: LibraryFolder) =>
  a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true });

/** DB rows → folder tree (siblings sorted by name). */
export function buildFolderTree(rows: LibraryFolder[]): FolderTree {
  return FolderTree.fromList(
    [...rows].sort(byName).map((row): Folder => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
    })),
  );
}

export interface LibraryState {
  folders: LibraryFolder[];
  tracks: LibraryTrack[];
}

export type LibraryChange =
  | { type: "create-folder"; folder: LibraryFolder }
  | { type: "rename-folder"; id: string; name: string }
  | { type: "move-folder"; id: string; parentId: string | null }
  | { type: "delete-folder"; id: string }
  | { type: "move-track"; id: string; folderId: string | null };

/**
 * Applies a change locally, the same way the database will (used for
 * optimistic updates). Invalid changes (e.g. a cycle) leave the state as is.
 */
export function applyLibraryChange(state: LibraryState, change: LibraryChange): LibraryState {
  switch (change.type) {
    case "create-folder":
      return { ...state, folders: [...state.folders, change.folder] };
    case "rename-folder":
      return {
        ...state,
        folders: state.folders.map((f) => (f.id === change.id ? { ...f, name: change.name } : f)),
      };
    case "move-folder": {
      if (!canMoveFolder(state.folders, change.id, change.parentId)) return state;
      return {
        ...state,
        folders: state.folders.map((f) =>
          f.id === change.id ? { ...f, parent_id: change.parentId } : f,
        ),
      };
    }
    case "delete-folder": {
      const tree = buildFolderTree(state.folders);
      if (!tree.has(change.id)) return state;
      // Subfolders go with it (ON DELETE CASCADE); tracks go back to the root (SET NULL).
      const removed = new Set(tree.remove(change.id));
      return {
        folders: state.folders.filter((f) => !removed.has(f.id)),
        tracks: state.tracks.map((t) =>
          t.folder_id && removed.has(t.folder_id) ? { ...t, folder_id: null } : t,
        ),
      };
    }
    case "move-track":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === change.id ? { ...t, folder_id: change.folderId } : t,
        ),
      };
  }
}

/** Whether `id` can go inside `parentId` (not itself, not a descendant, not where it is). */
export function canMoveFolder(
  folders: LibraryFolder[],
  id: string,
  parentId: string | null,
): boolean {
  const tree = buildFolderTree(folders);
  if (!tree.has(id) || (parentId !== null && !tree.has(parentId))) return false;
  if (tree.get(id)!.parentId === parentId) return false;
  return parentId === null || !tree.isDescendantOf(parentId, id);
}
