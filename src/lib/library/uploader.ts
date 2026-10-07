import type { SignUploadResponse } from "@/app/api/upload/sign/route";
import { supabaseEnv } from "@/lib/supabase/env";
import type { LibraryTrack } from "./tracks";

export class UploadError extends Error {
  constructor(readonly code: string) {
    super(`Upload failed: ${code}`);
    this.name = "UploadError";
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new UploadError("network");
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new UploadError(data.error ?? `http_${response.status}`);
  return data as T;
}

/**
 * PUTs the file to the signed Storage URL with XMLHttpRequest, because fetch
 * cannot report upload progress.
 */
export function putWithProgress(
  url: string,
  file: Blob,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("apikey", supabaseEnv().key);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new UploadError(xhr.status === 413 ? "too_large" : `storage_${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new UploadError("network"));
    xhr.onabort = () => reject(new UploadError("aborted"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export interface UploadOptions {
  title: string;
  artist?: string | null;
  origin: "file" | "video";
  durationS?: number | null;
  /** Embedded cover; uploaded best-effort to the `covers` bucket. */
  cover?: Blob | null;
  folderId?: string | null;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

/**
 * Uploads an audio file straight to Storage and registers it:
 * sign (server) → PUT (browser → Storage) → complete (server creates the row).
 * The cover, if any, goes the same way; a failed cover never fails the upload.
 */
export async function uploadAudio(file: File, options: UploadOptions): Promise<LibraryTrack> {
  const cover = options.cover ?? null;
  const signed = await postJson<SignUploadResponse>("/api/upload/sign", {
    mime: file.type,
    size: file.size,
    ...(cover ? { cover: { mime: cover.type, size: cover.size } } : {}),
  });
  await putWithProgress(signed.signedUrl, file, options.onProgress ?? (() => {}), options.signal);

  let coverMime: string | null = null;
  if (cover && signed.coverSignedUrl) {
    try {
      await putWithProgress(signed.coverSignedUrl, cover, () => {}, options.signal);
      coverMime = cover.type;
    } catch (error) {
      if (error instanceof UploadError && error.code === "aborted") throw error;
    }
  }

  return postJson<LibraryTrack>("/api/upload/complete", {
    trackId: signed.trackId,
    path: signed.path,
    mime: file.type,
    size: file.size,
    title: options.title,
    artist: options.artist ?? null,
    origin: options.origin,
    durationS: options.durationS ?? null,
    folderId: options.folderId ?? null,
    coverMime,
  });
}
