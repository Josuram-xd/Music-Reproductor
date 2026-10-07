import { create } from "zustand";
import { uploadErrorMessage } from "@/lib/library/messages";
import type { LibraryTrack } from "@/lib/library/tracks";
import { checkFile, titleFromFileName } from "@/lib/library/upload-rules";
import { UploadError, uploadAudio } from "@/lib/library/uploader";
import { ExtractError, extractAudio } from "@/lib/media/extract-audio";
import { readMetadata, type TrackMetadata } from "@/lib/media/read-metadata";

export type UploadStatus =
  "queued" | "loading-ffmpeg" | "extracting" | "uploading" | "saving" | "done" | "error";

export interface UploadItem {
  id: number;
  name: string;
  kind: "audio" | "video";
  status: UploadStatus;
  /** 0–1 within the current status. */
  progress: number;
  error?: string;
  track?: LibraryTrack;
}

interface UploadStore {
  items: UploadItem[];
  /** Increments on every finished upload (the library list refreshes on it). */
  completed: number;
  addFiles: (files: Iterable<File>, folderId?: string | null) => void;
  cancel: (id: number) => void;
  clearFinished: () => void;
}

/** Parallel uploads (videos still extract one at a time inside ffmpeg). */
const CONCURRENCY = 2;

let nextId = 1;
const pending: { id: number; file: File; folderId: string | null }[] = [];
const controllers = new Map<number, AbortController>();
let running = 0;

export const useUploadStore = create<UploadStore>()((set, get) => {
  const patch = (id: number, changes: Partial<UploadItem>) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));

  async function process(id: number, file: File, folderId: string | null) {
    const controller = new AbortController();
    controllers.set(id, controller);
    try {
      let audio = file;
      let meta: TrackMetadata = { title: null, artist: null, durationS: null, cover: null };
      const isVideo = get().items.find((i) => i.id === id)?.kind === "video";

      if (isVideo) {
        const extracted = await extractAudio(file, (stage, ratio) => {
          if (controller.signal.aborted) return; // cancelled: do not bring it back
          patch(id, {
            status: stage === "loading" ? "loading-ffmpeg" : "extracting",
            progress: ratio,
          });
        });
        audio = extracted.file;
        meta = { ...meta, durationS: extracted.durationS };
        const check = checkFile(audio);
        if (check.kind !== "audio") throw new UploadError("too_large");
      } else {
        meta = await readMetadata(file);
      }
      if (controller.signal.aborted) throw new UploadError("aborted");

      patch(id, { status: "uploading", progress: 0 });
      const track = await uploadAudio(audio, {
        title: meta.title ?? titleFromFileName(file.name),
        artist: meta.artist,
        origin: isVideo ? "video" : "file",
        durationS: meta.durationS,
        cover: meta.cover,
        folderId,
        signal: controller.signal,
        onProgress: (ratio) => {
          if (!controller.signal.aborted) {
            patch(id, { progress: ratio, status: ratio >= 1 ? "saving" : "uploading" });
          }
        },
      });
      patch(id, { status: "done", progress: 1, track });
      set((state) => ({ completed: state.completed + 1 }));
    } catch (error) {
      const code =
        error instanceof UploadError || error instanceof ExtractError ? error.code : "unknown";
      patch(id, { status: "error", error: uploadErrorMessage(code) });
    } finally {
      controllers.delete(id);
    }
  }

  function pump() {
    while (running < CONCURRENCY && pending.length > 0) {
      const job = pending.shift()!;
      running++;
      void process(job.id, job.file, job.folderId).finally(() => {
        running--;
        pump();
      });
    }
  }

  return {
    items: [],
    completed: 0,
    addFiles(files, folderId = null) {
      const added: UploadItem[] = [];
      for (const file of files) {
        const id = nextId++;
        const check = checkFile(file);
        if (check.kind === "rejected") {
          added.push({
            id,
            name: file.name,
            kind: "audio",
            status: "error",
            progress: 0,
            error: check.reason,
          });
          continue;
        }
        added.push({ id, name: file.name, kind: check.kind, status: "queued", progress: 0 });
        pending.push({ id, file, folderId });
      }
      set((state) => ({ items: [...state.items, ...added] }));
      pump();
    },
    cancel(id) {
      const index = pending.findIndex((job) => job.id === id);
      if (index >= 0) pending.splice(index, 1);
      controllers.get(id)?.abort();
      patch(id, { status: "error", error: uploadErrorMessage("aborted") });
    },
    clearFinished() {
      set((state) => ({
        items: state.items.filter((item) => item.status !== "done" && item.status !== "error"),
      }));
    },
  };
});
