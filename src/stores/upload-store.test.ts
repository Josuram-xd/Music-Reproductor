import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { UploadError } from "@/lib/library/uploader";
import { ExtractError } from "@/lib/media/extract-audio";
import { useUploadStore } from "./upload-store";

const NO_METADATA = { title: null, artist: null, durationS: null, cover: null };
const mocks = vi.hoisted(() => ({
  uploadAudio: vi.fn(),
  extractAudio: vi.fn(),
  readMetadata: vi.fn(),
}));

vi.mock("@/lib/library/uploader", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library/uploader")>()),
  uploadAudio: mocks.uploadAudio,
}));
vi.mock("@/lib/media/extract-audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/media/extract-audio")>()),
  extractAudio: mocks.extractAudio,
}));

vi.mock("@/lib/media/read-metadata", () => ({ readMetadata: mocks.readMetadata }));

const mp3 = (name = "song.mp3") => new File(["abc"], name, { type: "audio/mpeg" });
const items = () => useUploadStore.getState().items;
const byName = (name: string) => items().find((i) => i.name === name)!;

beforeEach(() => {
  mocks.readMetadata.mockResolvedValue(NO_METADATA);
});

afterEach(() => {
  useUploadStore.setState({ items: [], completed: 0 });
  vi.clearAllMocks();
});

describe("upload store", () => {
  test("uploads audio files and counts completions", async () => {
    mocks.uploadAudio.mockImplementation(async (_file, { onProgress }) => {
      onProgress(0.5);
      return { id: "t1" };
    });
    useUploadStore.getState().addFiles([mp3("01 - Neko_Lofi.mp3")], "folder-1");

    await vi.waitFor(() => expect(byName("01 - Neko_Lofi.mp3").status).toBe("done"));
    expect(useUploadStore.getState().completed).toBe(1);
    expect(mocks.uploadAudio).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ title: "01 - Neko Lofi", origin: "file", folderId: "folder-1" }),
    );
  });

  test("uses the file's tags (title, artist, duration, cover) when it has them", async () => {
    const cover = new Blob(["img"], { type: "image/jpeg" });
    mocks.readMetadata.mockResolvedValue({
      title: "Nyan Song",
      artist: "Neko Band",
      durationS: 201.5,
      cover,
    });
    mocks.uploadAudio.mockResolvedValue({ id: "t1" });
    useUploadStore.getState().addFiles([mp3("track01.mp3")]);

    await vi.waitFor(() => expect(byName("track01.mp3").status).toBe("done"));
    expect(mocks.uploadAudio).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({
        title: "Nyan Song",
        artist: "Neko Band",
        durationS: 201.5,
        cover,
      }),
    );
  });

  test("rejected files show their reason without uploading", () => {
    useUploadStore.getState().addFiles([new File(["x"], "photo.png", { type: "image/png" })]);
    expect(byName("photo.png")).toMatchObject({ status: "error" });
    expect(byName("photo.png").error).toMatch(/Formato/);
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
  });

  test("videos are converted to audio first and marked as 'video'", async () => {
    const extracted = new File(["aac"], "clip.m4a", { type: "audio/mp4" });
    mocks.extractAudio.mockImplementation(async (_file, onProgress) => {
      onProgress("loading", 0);
      onProgress("extracting", 0.5);
      return { file: extracted, durationS: 42, mode: "copy" };
    });
    mocks.uploadAudio.mockResolvedValue({ id: "t2" });
    useUploadStore.getState().addFiles([new File(["v"], "clip.mp4", { type: "video/mp4" })]);

    await vi.waitFor(() => expect(byName("clip.mp4").status).toBe("done"));
    expect(byName("clip.mp4").kind).toBe("video");
    expect(mocks.uploadAudio).toHaveBeenCalledWith(
      extracted,
      expect.objectContaining({ origin: "video", durationS: 42, title: "clip" }),
    );
  });

  test("extraction and upload errors are shown in Spanish", async () => {
    mocks.extractAudio.mockRejectedValue(new ExtractError("no-audio", "none"));
    mocks.uploadAudio.mockRejectedValue(new UploadError("too_large"));
    useUploadStore
      .getState()
      .addFiles([new File(["v"], "mute.mp4", { type: "video/mp4" }), mp3("big.mp3")]);

    await vi.waitFor(() => expect(byName("mute.mp4").status).toBe("error"));
    await vi.waitFor(() => expect(byName("big.mp3").status).toBe("error"));
    expect(byName("mute.mp4").error).toMatch(/no tiene sonido/);
    expect(byName("big.mp3").error).toMatch(/50 MB/);
    expect(useUploadStore.getState().completed).toBe(0);
  });

  test("runs at most two uploads at a time", async () => {
    const releases: (() => void)[] = [];
    mocks.uploadAudio.mockImplementation(
      () => new Promise((resolve) => releases.push(() => resolve({ id: "x" }))),
    );
    useUploadStore.getState().addFiles([mp3("a.mp3"), mp3("b.mp3"), mp3("c.mp3")]);

    await vi.waitFor(() => expect(mocks.uploadAudio).toHaveBeenCalledTimes(2));
    expect(byName("c.mp3").status).toBe("queued");
    releases.shift()!();
    await vi.waitFor(() => expect(mocks.uploadAudio).toHaveBeenCalledTimes(3));
    releases.forEach((release) => release());
    await vi.waitFor(() => expect(useUploadStore.getState().completed).toBe(3));
  });

  test("cancel stops a queued upload and aborts a running one", async () => {
    let signal: AbortSignal | undefined;
    mocks.uploadAudio.mockImplementation(
      (_file, options) =>
        new Promise((_resolve, reject) => {
          signal = options.signal;
          options.signal.addEventListener("abort", () => reject(new UploadError("aborted")));
        }),
    );
    useUploadStore.getState().addFiles([mp3("a.mp3"), mp3("b.mp3"), mp3("c.mp3")]);
    await vi.waitFor(() => expect(mocks.uploadAudio).toHaveBeenCalledTimes(2));

    useUploadStore.getState().cancel(byName("c.mp3").id); // still queued
    useUploadStore.getState().cancel(byName("a.mp3").id); // running
    expect(signal).toBeDefined();
    await vi.waitFor(() => expect(byName("a.mp3").error).toMatch(/cancelada/));
    expect(byName("c.mp3").status).toBe("error");
    expect(mocks.uploadAudio).toHaveBeenCalledTimes(2);
  });

  test("clearFinished keeps only active uploads", async () => {
    mocks.uploadAudio.mockResolvedValue({ id: "x" });
    useUploadStore.getState().addFiles([mp3("done.mp3"), new File(["x"], "bad.png")]);
    await vi.waitFor(() => expect(byName("done.mp3").status).toBe("done"));
    useUploadStore.getState().clearFinished();
    expect(items()).toEqual([]);
  });
});
