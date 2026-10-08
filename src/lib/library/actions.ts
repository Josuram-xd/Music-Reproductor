"use server";

import { refresh } from "next/cache";
import { authenticate } from "@/lib/auth/api";
import { UUID, validateFolderName } from "./folders";

/** Error codes are mapped to Spanish in the client (`folderErrorMessage`). */
export type LibraryActionResult = { ok: true } | { ok: false; error: string };

type Supabase = NonNullable<Awaited<ReturnType<typeof authenticate>>>["supabase"];

const fail = (error: string): LibraryActionResult => ({ ok: false, error });

const isId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const isParent = (value: unknown): value is string | null => value === null || isId(value);

/** Postgres error → action error code. */
function dbError(error: { code?: string }): LibraryActionResult {
  switch (error.code) {
    case "23514": // check_violation: cycle trigger or name length
      return fail("cycle");
    case "23503": // foreign key: the target folder does not exist (or is not theirs)
      return fail("not_found");
    case "23505":
      return fail("duplicate");
    default:
      return fail("failed");
  }
}

/** Runs a mutation as the signed-in user (RLS applies) and refreshes the page on success. */
async function mutate(
  run: (supabase: Supabase) => PromiseLike<{ error: { code?: string } | null; data?: unknown }>,
): Promise<LibraryActionResult> {
  const auth = await authenticate();
  if (!auth) return fail("unauthorized");
  const { error, data } = await run(auth.supabase);
  if (error) return dbError(error);
  // Updates/deletes that match no row (wrong id, or someone else's) return [].
  if (Array.isArray(data) && data.length === 0) return fail("not_found");
  refresh();
  return { ok: true };
}

/** `id` comes from the client so the optimistic folder and the real one match. */
export async function createFolder(
  id: string,
  name: string,
  parentId: string | null,
): Promise<LibraryActionResult> {
  const clean = validateFolderName(name);
  if (!clean) return fail("invalid_name");
  if (!isId(id) || !isParent(parentId)) return fail("invalid_request");
  return mutate((supabase) =>
    supabase.from("folders").insert({ id, name: clean, parent_id: parentId }).select("id"),
  );
}

export async function renameFolder(id: string, name: string): Promise<LibraryActionResult> {
  const clean = validateFolderName(name);
  if (!clean) return fail("invalid_name");
  if (!isId(id)) return fail("invalid_request");
  return mutate((supabase) =>
    supabase.from("folders").update({ name: clean }).eq("id", id).select("id"),
  );
}

/** The database rejects cycles (trigger) and other users' folders (RLS + FK). */
export async function moveFolder(
  id: string,
  parentId: string | null,
): Promise<LibraryActionResult> {
  if (!isId(id) || !isParent(parentId)) return fail("invalid_request");
  if (id === parentId) return fail("cycle");
  return mutate((supabase) =>
    supabase.from("folders").update({ parent_id: parentId }).eq("id", id).select("id"),
  );
}

/** Deletes the folder and its subfolders; their tracks move to the library root. */
export async function deleteFolder(id: string): Promise<LibraryActionResult> {
  if (!isId(id)) return fail("invalid_request");
  return mutate((supabase) => supabase.from("folders").delete().eq("id", id).select("id"));
}

export async function moveTrack(
  trackId: string,
  folderId: string | null,
): Promise<LibraryActionResult> {
  if (!isId(trackId) || !isParent(folderId)) return fail("invalid_request");
  return mutate((supabase) =>
    supabase.from("tracks").update({ folder_id: folderId }).eq("id", trackId).select("id"),
  );
}

/** Deletes a library track, its saved media, and its saved cover if present. */
export async function deleteTrack(id: string): Promise<LibraryActionResult> {
  if (!isId(id)) return fail("invalid_request");
  const auth = await authenticate();
  if (!auth) return fail("unauthorized");
  const { supabase } = auth;

  const { data: track, error: findError } = await supabase
    .from("tracks")
    .select("storage_path, cover_path")
    .eq("id", id)
    .maybeSingle();
  if (findError) return fail("failed");
  if (!track) return fail("not_found");

  const { data, error } = await supabase.from("tracks").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("not_found");

  refresh();
  const cleanup = await Promise.all([
    ...(track.storage_path ? [supabase.storage.from("media").remove([track.storage_path])] : []),
    ...(track.cover_path ? [supabase.storage.from("covers").remove([track.cover_path])] : []),
  ]);
  if (cleanup.some((result) => result.error)) return fail("storage_cleanup_failed");
  return { ok: true };
}
