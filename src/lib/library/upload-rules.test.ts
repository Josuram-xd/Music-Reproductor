import { describe, expect, test } from "vitest";
import {
  checkFile,
  coverPath,
  isValidCover,
  MAX_AUDIO_BYTES,
  MAX_COVER_BYTES,
  MAX_VIDEO_BYTES,
  mediaPath,
  titleFromFileName,
  validateUpload,
} from "./upload-rules";

const MB = 1024 * 1024;
const file = (name: string, type: string, size = 3 * MB) => ({ name, type, size });

describe("checkFile", () => {
  test.each([
    ["song.mp3", "audio/mpeg", "mp3"],
    ["song.m4a", "audio/mp4", "m4a"],
    ["song.m4a", "audio/x-m4a", "m4a"],
    ["song.flac", "audio/flac", "flac"],
    ["song.ogg", "audio/ogg", "ogg"],
    ["song.wav", "audio/wav", "wav"],
  ])("accepts %s (%s) as audio", (name, type, ext) => {
    expect(checkFile(file(name, type))).toEqual({ kind: "audio", mime: type, ext });
  });

  test("guesses the type from the extension when the browser gives none", () => {
    expect(checkFile(file("song.MP3", ""))).toMatchObject({ kind: "audio", mime: "audio/mpeg" });
    expect(checkFile(file("clip.mkv", ""))).toMatchObject({ kind: "video" });
  });

  test.each([
    ["clip.mp4", "video/mp4"],
    ["clip.mov", "video/quicktime"],
    ["clip.webm", "video/webm"],
  ])("sends %s to audio extraction", (name, type) => {
    expect(checkFile(file(name, type, 300 * MB))).toEqual({ kind: "video", mime: type });
  });

  test("audio over 50 MB is rejected, videos have a higher limit", () => {
    expect(checkFile(file("big.mp3", "audio/mpeg", MAX_AUDIO_BYTES + 1)).kind).toBe("rejected");
    expect(checkFile(file("ok.mp3", "audio/mpeg", MAX_AUDIO_BYTES)).kind).toBe("audio");
    expect(checkFile(file("big.mp4", "video/mp4", MAX_AUDIO_BYTES * 4)).kind).toBe("video");
    expect(checkFile(file("huge.mp4", "video/mp4", MAX_VIDEO_BYTES + 1)).kind).toBe("rejected");
  });

  test("rejects empty and unsupported files", () => {
    expect(checkFile(file("empty.mp3", "audio/mpeg", 0))).toMatchObject({ kind: "rejected" });
    expect(checkFile(file("photo.png", "image/png"))).toMatchObject({ kind: "rejected" });
    expect(checkFile(file("notes.txt", ""))).toMatchObject({ kind: "rejected" });
    expect(checkFile(file("song.aiff", "audio/aiff"))).toMatchObject({ kind: "rejected" });
  });
});

describe("validateUpload (server)", () => {
  test("accepts supported audio within the limit", () => {
    expect(validateUpload("audio/mpeg", 5 * MB)).toBeNull();
  });

  test.each([
    ["video/mp4", 5 * MB, "unsupported_type"],
    ["image/png", 5 * MB, "unsupported_type"],
    ["audio/mpeg", 0, "invalid_size"],
    ["audio/mpeg", 1.5, "invalid_size"],
    ["audio/mpeg", NaN, "invalid_size"],
    ["audio/mpeg", MAX_AUDIO_BYTES + 1, "too_large"],
  ])("%s, %d bytes → %s", (mime, size, code) => {
    expect(validateUpload(mime, size)).toBe(code);
  });
});

describe("mediaPath", () => {
  test("puts the file in the user's folder with the right extension", () => {
    expect(mediaPath("user-1", "track-1", "audio/mp4")).toBe("user-1/track-1.m4a");
    expect(mediaPath("user-1", "track-1", "audio/mpeg")).toBe("user-1/track-1.mp3");
  });

  test("throws for unsupported types", () => {
    expect(() => mediaPath("u", "t", "video/mp4")).toThrow();
  });
});

describe("covers", () => {
  test("isValidCover accepts what the bucket accepts", () => {
    expect(isValidCover("image/jpeg", 1000)).toBe(true);
    expect(isValidCover("image/webp", MAX_COVER_BYTES)).toBe(true);
    expect(isValidCover("image/gif", 1000)).toBe(false);
    expect(isValidCover("image/png", MAX_COVER_BYTES + 1)).toBe(false);
    expect(isValidCover("image/png", 0)).toBe(false);
    expect(isValidCover(undefined, 10)).toBe(false);
  });

  test("coverPath uses the user's folder", () => {
    expect(coverPath("u", "t", "image/png")).toBe("u/t.png");
    expect(() => coverPath("u", "t", "image/gif")).toThrow();
  });
});

describe("titleFromFileName", () => {
  test.each([
    ["01 - Neko_Lofi.mp3", "01 - Neko Lofi"],
    ["  spaced   out .flac", "spaced out"],
    ["no-extension", "no-extension"],
    [".mp3", "Sin título"],
  ])("%j → %j", (name, title) => {
    expect(titleFromFileName(name)).toBe(title);
  });

  test("limits the length to 300 characters", () => {
    expect(titleFromFileName(`${"a".repeat(400)}.mp3`)).toHaveLength(300);
  });
});
