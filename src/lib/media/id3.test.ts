import { describe, expect, test } from "vitest";
import { hasId3, id3TagSize, parseId3 } from "./id3";

const latin1 = (text: string) => [...text].map((c) => c.charCodeAt(0));
const utf8 = (text: string) => [...new TextEncoder().encode(text)];
const utf16le = (text: string) => {
  const out = [0xff, 0xfe];
  for (const c of text) out.push(c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8);
  return out;
};

const syncsafe = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const be24 = (n: number) => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

function frame(version: 2 | 3 | 4, id: string, body: number[], flags = 0): number[] {
  if (version === 2) return [...latin1(id), ...be24(body.length), ...body];
  const size = version === 4 ? syncsafe(body.length) : be32(body.length);
  return [...latin1(id), ...size, flags >> 8, flags & 0xff, ...body];
}

function tag(version: 2 | 3 | 4, frames: number[][], { flags = 0, padding = 16 } = {}) {
  const body = [...frames.flat(), ...new Array<number>(padding).fill(0)];
  return new Uint8Array([...latin1("ID3"), version, 0, flags, ...syncsafe(body.length), ...body]);
}

const text = (encoding: number, bytes: number[]) => [encoding, ...bytes];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
const PNG = [0x89, 0x50, 0x4e, 0x47];

describe("hasId3 / id3TagSize", () => {
  test("detects the header and computes the full tag length", () => {
    const bytes = tag(3, [frame(3, "TIT2", text(0, latin1("x")))]);
    expect(hasId3(bytes)).toBe(true);
    expect(id3TagSize(bytes.subarray(0, 10))).toBe(bytes.length);
  });

  test("returns 0 without a tag", () => {
    expect(hasId3(new Uint8Array([0xff, 0xfb, 0x90]))).toBe(false);
    expect(id3TagSize(new Uint8Array(10))).toBe(0);
  });
});

describe("parseId3", () => {
  test("v2.3 text frames in Latin-1 and UTF-16", () => {
    const tags = parseId3(
      tag(3, [
        frame(3, "TIT2", text(1, [...utf16le("Canción"), 0, 0])),
        frame(3, "TPE1", text(0, latin1("Neko Band"))),
        frame(3, "TALB", text(0, [...latin1("Lofi"), 0])),
      ]),
    );
    expect(tags).toEqual({ title: "Canción", artist: "Neko Band", album: "Lofi", picture: null });
  });

  test("v2.4 UTF-8 with multiple values and syncsafe sizes", () => {
    const tags = parseId3(
      tag(4, [
        frame(4, "TIT2", text(3, utf8("Nyan ✨"))),
        frame(4, "TPE1", text(3, [...utf8("A"), 0, ...utf8("B")])),
      ]),
    );
    expect(tags).toMatchObject({ title: "Nyan ✨", artist: "A, B" });
  });

  test("v2.2 three-letter frames and PIC", () => {
    const tags = parseId3(
      tag(2, [
        frame(2, "TT2", text(0, latin1("Old"))),
        frame(2, "TP1", text(0, latin1("Cat"))),
        frame(2, "PIC", [0, ...latin1("PNG"), 3, 0, ...PNG]),
      ]),
    );
    expect(tags?.title).toBe("Old");
    expect(tags?.artist).toBe("Cat");
    expect(tags?.picture).toEqual({ mime: "image/png", data: new Uint8Array(PNG) });
  });

  test("APIC prefers the front cover over other pictures", () => {
    const apic = (type: number, data: number[], mime = "image/jpeg") => [
      0,
      ...latin1(mime),
      0,
      type,
      ...latin1("desc"),
      0,
      ...data,
    ];
    const tags = parseId3(
      tag(3, [frame(3, "APIC", apic(4, PNG, "image/png")), frame(3, "APIC", apic(3, JPEG))]),
    );
    expect(tags?.picture).toEqual({ mime: "image/jpeg", data: new Uint8Array(JPEG) });
  });

  test("APIC with a UTF-16 description and 'image/jpg'", () => {
    const body = [1, ...latin1("image/jpg"), 0, 3, ...utf16le("tapa"), 0, 0, ...JPEG];
    expect(parseId3(tag(3, [frame(3, "APIC", body)]))?.picture?.mime).toBe("image/jpeg");
  });

  test("undoes whole-tag unsynchronisation (v2.3)", () => {
    // Writers insert 00 after every FF: FF D8 → FF 00 D8.
    // The frame size counts the bytes after undoing it.
    const body = [0, ...latin1("image/jpeg"), 0, 3, 0, 0xff, 0x00, 0xd8, 0x01];
    const apic = [...latin1("APIC"), ...be32(body.length - 1), 0, 0, ...body];
    const tags = parseId3(tag(3, [apic], { flags: 0x80 }));
    expect(tags?.picture?.data).toEqual(new Uint8Array([0xff, 0xd8, 0x01]));
  });

  test("skips compressed frames and stops at padding", () => {
    const tags = parseId3(
      tag(4, [
        frame(4, "TIT2", text(0, latin1("zlib")), 0x0008),
        frame(4, "TPE1", text(0, latin1("ok"))),
      ]),
    );
    expect(tags).toMatchObject({ title: null, artist: "ok" });
  });

  test("tolerates truncated tags", () => {
    const full = tag(3, [frame(3, "TIT2", text(0, latin1("Long title here")))]);
    expect(parseId3(full.subarray(0, 18))).toEqual({
      title: null,
      artist: null,
      album: null,
      picture: null,
    });
  });

  test("returns null for files without ID3v2", () => {
    expect(parseId3(new Uint8Array([0xff, 0xfb, 0x90, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});
