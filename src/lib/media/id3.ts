/**
 * Minimal ID3v2 (2.2 / 2.3 / 2.4) reader: title, artist, album and the cover
 * picture. Pure (works on bytes), so the browser only has to read the first
 * part of the file.
 */

export interface Id3Picture {
  mime: string;
  data: Uint8Array;
}

export interface Id3Tags {
  title: string | null;
  artist: string | null;
  album: string | null;
  picture: Id3Picture | null;
}

const HEADER_SIZE = 10;
/** APIC picture type for the front cover. */
const FRONT_COVER = 3;

const TEXT_FRAMES: Readonly<Record<string, keyof Omit<Id3Tags, "picture">>> = {
  TIT2: "title",
  TT2: "title",
  TPE1: "artist",
  TP1: "artist",
  TALB: "album",
  TAL: "album",
};

const syncsafe = (b: Uint8Array, i: number) =>
  ((b[i]! & 0x7f) << 21) |
  ((b[i + 1]! & 0x7f) << 14) |
  ((b[i + 2]! & 0x7f) << 7) |
  (b[i + 3]! & 0x7f);

const uint32 = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;

const uint24 = (b: Uint8Array, i: number) => (b[i]! << 16) | (b[i + 1]! << 8) | b[i + 2]!;

/** Whether `bytes` starts with an ID3v2 header. */
export function hasId3(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
}

/** Total tag length (header included) from the first 10 bytes, or 0 if there is no tag. */
export function id3TagSize(header: Uint8Array): number {
  if (header.length < HEADER_SIZE || !hasId3(header)) return 0;
  const footer = header[5]! & 0x10 ? HEADER_SIZE : 0;
  return HEADER_SIZE + syncsafe(header, 6) + footer;
}

/** Undoes "unsynchronisation": every `FF 00` becomes `FF`. */
function unsync(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let length = 0;
  for (let i = 0; i < bytes.length; i++) {
    out[length++] = bytes[i]!;
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i++;
  }
  return out.subarray(0, length);
}

/** Index of the string terminator for `encoding` (1 or 2 null bytes), or -1. */
function terminator(bytes: Uint8Array, start: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
    }
    return -1;
  }
  return bytes.indexOf(0, start);
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  switch (encoding) {
    case 1: {
      // UTF-16 with BOM (little endian if there is none)
      if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(bytes.subarray(2));
      }
      const start = bytes[0] === 0xff && bytes[1] === 0xfe ? 2 : 0;
      return new TextDecoder("utf-16le").decode(bytes.subarray(start));
    }
    case 2:
      return new TextDecoder("utf-16be").decode(bytes);
    case 3:
      return new TextDecoder("utf-8").decode(bytes);
    default:
      return new TextDecoder("latin1").decode(bytes);
  }
}

/** Text frame body → value. v2.4 separates multiple values with nulls: they are joined. */
function readTextFrame(body: Uint8Array): string | null {
  if (body.length < 2) return null;
  const encoding = body[0]!;
  const values: string[] = [];
  let start = 1;
  while (start < body.length) {
    const end = terminator(body, start, encoding);
    const value = decodeText(body.subarray(start, end < 0 ? body.length : end), encoding).trim();
    if (value) values.push(value);
    if (end < 0) break;
    start = end + (encoding === 1 || encoding === 2 ? 2 : 1);
  }
  return values.length > 0 ? values.join(", ") : null;
}

const IMAGE_FORMATS: Readonly<Record<string, string>> = {
  JPG: "image/jpeg",
  PNG: "image/png",
  "image/jpg": "image/jpeg",
};

/** APIC (v2.3/2.4) or PIC (v2.2) body → picture and its type. */
function readPictureFrame(
  body: Uint8Array,
  v22: boolean,
): { picture: Id3Picture; type: number } | null {
  const encoding = body[0]!;
  let mime: string;
  let offset: number;
  if (v22) {
    mime = new TextDecoder("latin1").decode(body.subarray(1, 4)).toUpperCase();
    offset = 4;
  } else {
    const end = body.indexOf(0, 1);
    if (end < 0) return null;
    mime = new TextDecoder("latin1").decode(body.subarray(1, end)).trim().toLowerCase();
    offset = end + 1;
  }
  const type = body[offset]!;
  const descriptionEnd = terminator(body, offset + 1, encoding);
  if (descriptionEnd < 0) return null;
  const data = body.slice(descriptionEnd + (encoding === 1 || encoding === 2 ? 2 : 1));
  if (data.length === 0) return null;
  mime = IMAGE_FORMATS[mime] ?? (mime.includes("/") ? mime : "image/jpeg");
  return { picture: { mime, data }, type };
}

/**
 * Parses the ID3v2 tag at the start of `bytes`. Returns `null` when there is
 * none. Unknown, compressed or encrypted frames are skipped.
 */
export function parseId3(bytes: Uint8Array): Id3Tags | null {
  if (bytes.length < HEADER_SIZE || !hasId3(bytes)) return null;
  const version = bytes[3]!;
  if (version < 2 || version > 4) return null;
  const flags = bytes[5]!;
  const end = Math.min(bytes.length, HEADER_SIZE + syncsafe(bytes, 6));

  let tag = bytes.subarray(HEADER_SIZE, end);
  // v2.2/2.3 unsynchronise the whole tag; v2.4 does it per frame.
  if (flags & 0x80 && version < 4) tag = unsync(tag);

  let pos = 0;
  if (flags & 0x40 && version > 2) {
    pos = version === 4 ? syncsafe(tag, 0) : uint32(tag, 0) + 4;
  }

  const v22 = version === 2;
  const idLength = v22 ? 3 : 4;
  const frameHeader = v22 ? 6 : 10;
  const tags: Id3Tags = { title: null, artist: null, album: null, picture: null };
  let pictureType = -1;

  while (pos + frameHeader <= tag.length) {
    if (tag[pos] === 0) break; // padding
    const id = String.fromCharCode(...tag.subarray(pos, pos + idLength));
    const size = v22
      ? uint24(tag, pos + 3)
      : version === 4
        ? syncsafe(tag, pos + 4)
        : uint32(tag, pos + 4);
    const frameFlags = v22 ? 0 : (tag[pos + 8]! << 8) | tag[pos + 9]!;
    const start = pos + frameHeader;
    pos = start + size;
    if (size <= 0 || pos > tag.length) break;

    const compressedOrEncrypted = version === 4 ? frameFlags & 0x000c : frameFlags & 0x00c0;
    if (compressedOrEncrypted) continue;

    let body = tag.subarray(start, pos);
    if (version === 4) {
      if (frameFlags & 0x0001) body = body.subarray(4); // data length indicator
      if (frameFlags & 0x0002) body = unsync(body);
    }

    const field = TEXT_FRAMES[id];
    if (field) {
      tags[field] ??= readTextFrame(body);
    } else if (id === "APIC" || id === "PIC") {
      // Keep the front cover if there is one, otherwise the first picture.
      if (pictureType === FRONT_COVER) continue;
      const found = readPictureFrame(body, v22);
      if (found && (tags.picture === null || found.type === FRONT_COVER)) {
        tags.picture = found.picture;
        pictureType = found.type;
      }
    }
  }
  return tags;
}
