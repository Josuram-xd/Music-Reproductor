import { describe, expect, test } from "vitest";
import {
  audioFileName,
  outputOf,
  parseAudioCodec,
  parseDuration,
  planExtraction,
} from "./audio-plan";

const MP4_LOG = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/input/clip.mp4':
  Duration: 00:03:45.12, start: 0.000000, bitrate: 1205 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1280x720, 1070 kb/s
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)
At least one output file must be specified`;

describe("parseAudioCodec", () => {
  test.each([
    [MP4_LOG, "aac"],
    ["  Stream #0:1: Audio: opus, 48000 Hz, stereo, fltp (default)", "opus"],
    ["  Stream #0:1(eng): Audio: AC3, 48000 Hz, 5.1(side)", "ac3"],
    ["  Stream #0:2: Audio: mp3 (mp3float), 44100 Hz", "mp3"],
    ["  Stream #0:1: Audio: pcm_s16le, 48000 Hz", "pcm_s16le"],
  ])("finds the audio codec", (log, codec) => {
    expect(parseAudioCodec(log)).toBe(codec);
  });

  test("returns null for videos without audio", () => {
    expect(parseAudioCodec("  Stream #0:0: Video: vp9, yuv420p, 1920x1080")).toBeNull();
  });
});

describe("parseDuration", () => {
  test("reads hours, minutes and seconds", () => {
    expect(parseDuration(MP4_LOG)).toBeCloseTo(225.12);
    expect(parseDuration("Duration: 01:02:03.5, start")).toBeCloseTo(3723.5);
  });

  test("returns null when unknown", () => {
    expect(parseDuration("Duration: N/A, bitrate: N/A")).toBeNull();
  });
});

describe("planExtraction", () => {
  test("copies AAC into .m4a, with re-encoding as the fallback", () => {
    const steps = planExtraction("aac", "/input/clip.mp4", "out");
    expect(steps.map((s) => [s.mode, s.ext, s.mime])).toEqual([
      ["copy", "m4a", "audio/mp4"],
      ["encode", "m4a", "audio/mp4"],
    ]);
    expect(steps[0]!.args).toEqual([
      "-hide_banner",
      "-i",
      "/input/clip.mp4",
      "-map",
      "0:a:0",
      "-vn",
      "-sn",
      "-dn",
      "-c:a",
      "copy",
      "out.m4a",
    ]);
    expect(steps[1]!.args).toContain("aac");
    expect(outputOf(steps[1]!)).toBe("out-aac.m4a");
  });

  test.each([
    ["mp3", "mp3", "audio/mpeg"],
    ["opus", "webm", "audio/webm"],
    ["vorbis", "ogg", "audio/ogg"],
    ["flac", "flac", "audio/flac"],
  ])("copies %s into .%s", (codec, ext, mime) => {
    const [first] = planExtraction(codec, "in", "out");
    expect(first).toMatchObject({ mode: "copy", ext, mime });
    expect(outputOf(first!)).toBe(`out.${ext}`);
  });

  test.each(["ac3", "eac3", "dts", "pcm_s16le", "alac", "wmav2"])(
    "re-encodes %s straight away",
    (codec) => {
      const steps = planExtraction(codec, "in", "out");
      expect(steps).toHaveLength(1);
      expect(steps[0]!.mode).toBe("encode");
    },
  );
});

describe("audioFileName", () => {
  test("swaps the extension", () => {
    expect(audioFileName("Concierto en vivo.mp4", "m4a")).toBe("Concierto en vivo.m4a");
    expect(audioFileName("clip.final.mkv", "webm")).toBe("clip.final.webm");
    expect(audioFileName("noext", "mp3")).toBe("noext.mp3");
  });
});
