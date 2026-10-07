import { COVER_TYPES, MAX_COVER_BYTES } from "@/lib/library/upload-rules";
import { id3TagSize, parseId3 } from "./id3";

export interface TrackMetadata {
  title: string | null;
  artist: string | null;
  durationS: number | null;
  /** Embedded cover, only if the `covers` bucket accepts it (type and size). */
  cover: Blob | null;
}

/** Tags bigger than this are ignored (some files embed huge pictures). */
const MAX_TAG_BYTES = 16 * 1024 * 1024;
const DURATION_TIMEOUT_MS = 10_000;

const readBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

/** Duration from the browser's own decoder (works for every format it can play). */
export function probeDuration(file: Blob, timeoutMs = DURATION_TIMEOUT_MS): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const finish = (value: number | null) => {
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const { duration } = audio;
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    audio.onerror = () => finish(null);
    audio.src = url;
  });
}

/** Title, artist and cover from the ID3v2 tag at the start of the file, if any. */
async function readTags(file: Blob): Promise<Omit<TrackMetadata, "durationS">> {
  const none = { title: null, artist: null, cover: null };
  const size = id3TagSize(await readBytes(file.slice(0, 10)));
  if (size === 0 || size > MAX_TAG_BYTES) return none;
  const tags = parseId3(await readBytes(file.slice(0, size)));
  if (!tags) return none;
  const picture = tags.picture;
  const cover =
    picture && COVER_TYPES[picture.mime] && picture.data.byteLength <= MAX_COVER_BYTES
      ? new Blob([picture.data.slice().buffer], { type: picture.mime })
      : null;
  return { title: tags.title, artist: tags.artist, cover };
}

/**
 * Reads what can be known about an audio file in the browser before uploading
 * it. Never throws: anything unreadable is just `null`.
 */
export async function readMetadata(file: Blob): Promise<TrackMetadata> {
  const [tags, durationS] = await Promise.all([
    readTags(file).catch(() => ({ title: null, artist: null, cover: null })),
    probeDuration(file).catch(() => null),
  ]);
  return { ...tags, durationS };
}
