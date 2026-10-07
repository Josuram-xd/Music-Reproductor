import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  audioFileName,
  type ExtractionStep,
  outputOf,
  parseAudioCodec,
  parseDuration,
  planExtraction,
} from "./audio-plan";

/**
 * Single-thread ffmpeg core (no SharedArrayBuffer, so no COOP/COEP headers,
 * which would break the YouTube iframe). ~30 MB, downloaded on first use only.
 */
const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
/**
 * @ffmpeg/ffmpeg itself, served from our origin (scripts/copy-ffmpeg.mjs):
 * bundlers cannot handle its worker, and workers must be same-origin.
 */
const FFMPEG_MODULE_URL = "/vendor/ffmpeg/index.js";

/** Downloads a cross-origin file into a same-origin blob: URL (what ffmpeg.load expects). */
async function toBlobURL(url: string, type: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
}

export type ExtractStage = "loading" | "extracting";

export class ExtractError extends Error {
  constructor(
    readonly code: "no-audio" | "failed" | "load-failed",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ExtractError";
  }
}

export interface ExtractedAudio {
  file: File;
  durationS: number | null;
  mode: ExtractionStep["mode"];
}

let ffmpegPromise: Promise<FFmpeg> | null = null;
/** ffmpeg runs one job at a time; jobs wait in this chain. */
let queue: Promise<unknown> = Promise.resolve();
let onJobProgress: ((ratio: number) => void) | null = null;
let jobLog: string[] = [];

function loadFFmpeg(): Promise<FFmpeg> {
  ffmpegPromise ??= (async () => {
    const { FFmpeg } = (await import(
      /* webpackIgnore: true */ FFMPEG_MODULE_URL
    )) as typeof import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => jobLog.push(message));
    ffmpeg.on("progress", ({ progress }) => {
      if (Number.isFinite(progress)) onJobProgress?.(Math.min(1, Math.max(0, progress)));
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ffmpeg;
  })().catch((error: unknown) => {
    ffmpegPromise = null; // allow a retry later
    throw new ExtractError("load-failed", "Could not load ffmpeg.wasm", { cause: error });
  });
  return ffmpegPromise;
}

async function run(
  ffmpeg: FFmpeg,
  args: string[],
  onProgress: ((ratio: number) => void) | null,
): Promise<{ code: number; log: string }> {
  jobLog = [];
  onJobProgress = onProgress;
  try {
    const code = await ffmpeg.exec(args);
    return { code, log: jobLog.join("\n") };
  } finally {
    onJobProgress = null;
  }
}

/** Mounts the video without copying it into wasm memory (WORKERFS); falls back to a copy. */
async function mountInput(
  ffmpeg: FFmpeg,
  file: File,
): Promise<{ input: string; cleanup: () => Promise<void> }> {
  const dir = `/in-${Date.now()}`;
  try {
    await ffmpeg.createDir(dir);
    await ffmpeg.mount("WORKERFS" as never, { files: [file] }, dir);
    return {
      input: `${dir}/${file.name}`,
      cleanup: async () => {
        await ffmpeg.unmount(dir).catch(() => undefined);
        await ffmpeg.deleteDir(dir).catch(() => undefined);
      },
    };
  } catch {
    const input = `${dir}-${file.name}`;
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    return {
      input,
      cleanup: () =>
        ffmpeg
          .deleteFile(input)
          .then(() => undefined)
          .catch(() => undefined),
    };
  }
}

async function extract(
  file: File,
  onProgress: (stage: ExtractStage, ratio: number) => void,
): Promise<ExtractedAudio> {
  onProgress("loading", 0);
  const ffmpeg = await loadFFmpeg();
  onProgress("extracting", 0);

  const { input, cleanup } = await mountInput(ffmpeg, file);
  try {
    // `-i` alone exits with an error but prints the streams we need.
    const probe = await run(ffmpeg, ["-hide_banner", "-i", input], null);
    const codec = parseAudioCodec(probe.log);
    if (!codec) throw new ExtractError("no-audio", "The video has no audio track");
    const durationS = parseDuration(probe.log);

    const outputBase = `/out-${Date.now()}`;
    for (const step of planExtraction(codec, input, outputBase)) {
      const output = outputOf(step);
      const { code } = await run(ffmpeg, step.args, (ratio) => onProgress("extracting", ratio));
      if (code !== 0) continue; // e.g. codec does not fit the container → re-encode
      const data = await ffmpeg.readFile(output);
      await ffmpeg.deleteFile(output).catch(() => undefined);
      if (!(data instanceof Uint8Array) || data.byteLength === 0) continue;
      onProgress("extracting", 1);
      return {
        file: new File([data.slice().buffer], audioFileName(file.name, step.ext), {
          type: step.mime,
        }),
        durationS,
        mode: step.mode,
      };
    }
    throw new ExtractError("failed", `Could not extract the audio (${codec})`);
  } finally {
    await cleanup();
  }
}

/**
 * Extracts the audio of a local video in the browser with ffmpeg.wasm
 * (`-c:a copy` when possible, AAC re-encode otherwise). The video never
 * leaves the PC. Jobs run one after another.
 */
export function extractAudio(
  file: File,
  onProgress: (stage: ExtractStage, ratio: number) => void = () => {},
): Promise<ExtractedAudio> {
  const job = queue.then(() => extract(file, onProgress));
  queue = job.catch(() => undefined);
  return job;
}
