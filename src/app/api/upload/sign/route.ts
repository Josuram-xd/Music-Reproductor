import { NextResponse } from "next/server";
import { apiError, authenticate, readJson } from "@/lib/auth/api";
import { coverPath, isValidCover, mediaPath, validateUpload } from "@/lib/library/upload-rules";

export interface SignUploadResponse {
  trackId: string;
  path: string;
  signedUrl: string;
  /** Only when a valid cover was announced and its URL could be signed. */
  coverSignedUrl?: string;
}

/**
 * Step 1 of an upload: validates type and size, picks the track id and the
 * object path, and returns a signed upload URL. The browser then PUTs the
 * file straight to Storage (it never goes through Vercel, ~4.5 MB limit).
 */
export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth) return apiError("unauthorized", 401);

  const body = await readJson(request);
  const mime = typeof body?.mime === "string" ? body.mime : "";
  const size = typeof body?.size === "number" ? body.size : NaN;
  const invalid = validateUpload(mime, size);
  if (invalid) return apiError(invalid, 400);

  const trackId = crypto.randomUUID();
  const path = mediaPath(auth.userId, trackId, mime);
  // Signed with the user's session: Storage RLS only allows their own folder.
  const { data, error } = await auth.supabase.storage.from("media").createSignedUploadUrl(path);
  if (error || !data) return apiError("sign_failed", 502);

  const response: SignUploadResponse = { trackId, path, signedUrl: data.signedUrl };
  const cover = body?.cover as { mime?: unknown; size?: unknown } | undefined;
  if (cover && isValidCover(cover.mime, cover.size)) {
    const { data: coverData } = await auth.supabase.storage
      .from("covers")
      .createSignedUploadUrl(coverPath(auth.userId, trackId, cover.mime));
    if (coverData) response.coverSignedUrl = coverData.signedUrl;
  }
  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
