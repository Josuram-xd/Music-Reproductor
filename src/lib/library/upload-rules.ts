/**
 * What can be uploaded and how it is stored. Shared by the browser (to reject
 * early) and the server (the real check). Free Supabase plan: 50 MB per file.
 */

export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
/** Videos never leave the PC, but ffmpeg.wasm has to read them in memory-ish. */
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

/** Audio types we store, with the extension used in Storage. */
export const AUDIO_TYPES: Readonly<Record<string, string>> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

const AUDIO_EXTENSIONS: Readonly<Record<string, string>> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  weba: "audio/webm",
  flac: "audio/flac",
  wav: "audio/wav",
};

const VIDEO_EXTENSIONS: Readonly<Record<string, string>> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mkv: "video/x-matroska",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  "3gp": "video/3gpp",
  ts: "video/mp2t",
};

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export type FileCheck =
  | { kind: "audio"; mime: string; ext: string }
  | { kind: "video"; mime: string }
  | { kind: "rejected"; reason: string };

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

const formatMb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Classifies a dropped/picked file. Falls back to the extension when the browser gives no type. */
export function checkFile(file: FileLike): FileCheck {
  const ext = extensionOf(file.name);
  const type = file.type.toLowerCase() || AUDIO_EXTENSIONS[ext] || VIDEO_EXTENSIONS[ext] || "";

  if (file.size === 0) return { kind: "rejected", reason: "El archivo está vacío" };

  if (type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) {
      return { kind: "rejected", reason: `El vídeo pasa de ${formatMb(MAX_VIDEO_BYTES)}` };
    }
    return { kind: "video", mime: type };
  }

  const storedExt = AUDIO_TYPES[type];
  if (storedExt) {
    if (file.size > MAX_AUDIO_BYTES) {
      return {
        kind: "rejected",
        reason: `Pasa de ${formatMb(MAX_AUDIO_BYTES)} (límite por archivo)`,
      };
    }
    return { kind: "audio", mime: type, ext: storedExt };
  }

  return { kind: "rejected", reason: "Formato no compatible. Sube audio o vídeo, nya~" };
}

/** Server-side check of what the browser says it will upload. */
export function validateUpload(mime: string, size: number): string | null {
  if (!AUDIO_TYPES[mime]) return "unsupported_type";
  if (!Number.isInteger(size) || size <= 0) return "invalid_size";
  if (size > MAX_AUDIO_BYTES) return "too_large";
  return null;
}

/** Object path in the `media` bucket: `{uid}/{trackId}.{ext}`. */
export function mediaPath(userId: string, trackId: string, mime: string): string {
  const ext = AUDIO_TYPES[mime];
  if (!ext) throw new Error(`Unsupported audio type "${mime}"`);
  return `${userId}/${trackId}.${ext}`;
}

/** Same limits as the `covers` bucket. */
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const COVER_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Server-side check of an embedded cover. */
export function isValidCover(mime: unknown, size: unknown): mime is string {
  return (
    typeof mime === "string" &&
    Boolean(COVER_TYPES[mime]) &&
    typeof size === "number" &&
    Number.isInteger(size) &&
    size > 0 &&
    size <= MAX_COVER_BYTES
  );
}

/** Object path in the `covers` bucket: `{uid}/{trackId}.{ext}`. */
export function coverPath(userId: string, trackId: string, mime: string): string {
  const ext = COVER_TYPES[mime];
  if (!ext) throw new Error(`Unsupported cover type "${mime}"`);
  return `${userId}/${trackId}.${ext}`;
}

/** "01 - Neko_Lofi.mp3" → "01 - Neko Lofi". */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  const title = base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return (title || "Sin título").slice(0, 300);
}
