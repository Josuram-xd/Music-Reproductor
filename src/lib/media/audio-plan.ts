/**
 * Pure helpers for extracting the audio track of a video with ffmpeg:
 * copy the stream as-is when a browser-friendly container exists for its
 * codec (fast, lossless), otherwise re-encode to AAC.
 */

export interface AudioOutput {
  ext: string;
  mime: string;
}

export interface ExtractionStep extends AudioOutput {
  mode: "copy" | "encode";
  args: string[];
}

/** Codecs we can copy without re-encoding, and the container they go in. */
const COPY_TARGETS: Readonly<Record<string, AudioOutput>> = {
  aac: { ext: "m4a", mime: "audio/mp4" },
  mp3: { ext: "mp3", mime: "audio/mpeg" },
  opus: { ext: "webm", mime: "audio/webm" },
  vorbis: { ext: "ogg", mime: "audio/ogg" },
  flac: { ext: "flac", mime: "audio/flac" },
};

export const ENCODE_TARGET: AudioOutput = { ext: "m4a", mime: "audio/mp4" };
export const ENCODE_BITRATE = "192k";

/**
 * First audio codec in ffmpeg's `-i` output, e.g.
 * `Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz` → "aac".
 */
export function parseAudioCodec(log: string): string | null {
  const match = /Stream #\d+:\d+\S*:\s*Audio:\s*([a-z0-9_]+)/i.exec(log);
  return match ? match[1]!.toLowerCase() : null;
}

/** Duration from ffmpeg's `Duration: 00:03:45.12` line, in seconds. */
export function parseDuration(log: string): number | null {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(log);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

const BASE_ARGS = (input: string) => [
  "-hide_banner",
  "-i",
  input,
  "-map",
  "0:a:0",
  "-vn",
  "-sn",
  "-dn",
];

/** The steps to try, in order: copy (if possible), then re-encode as the fallback. */
export function planExtraction(codec: string, input: string, outputBase: string): ExtractionStep[] {
  const steps: ExtractionStep[] = [];
  const copy = COPY_TARGETS[codec];
  if (copy) {
    steps.push({
      mode: "copy",
      ...copy,
      args: [...BASE_ARGS(input), "-c:a", "copy", `${outputBase}.${copy.ext}`],
    });
  }
  steps.push({
    mode: "encode",
    ...ENCODE_TARGET,
    args: [
      ...BASE_ARGS(input),
      "-c:a",
      "aac",
      "-b:a",
      ENCODE_BITRATE,
      `${outputBase}-aac.${ENCODE_TARGET.ext}`,
    ],
  });
  return steps;
}

/** Output path of a step (last argument). */
export const outputOf = (step: ExtractionStep) => step.args[step.args.length - 1]!;

/** "Concierto en vivo.mp4" → "Concierto en vivo.m4a" */
export function audioFileName(videoName: string, ext: string): string {
  const base = videoName.replace(/\.[^./\\]+$/, "") || "audio";
  return `${base}.${ext}`;
}
