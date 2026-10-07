import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { putWithProgress, UploadError, uploadAudio } from "./uploader";

/** Scriptable XMLHttpRequest. */
class FakeXHR {
  static last: FakeXHR;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXHR.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.onabort?.();
  }
  /** Test helpers */
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }
  finish(status: number) {
    this.status = status;
    this.onload?.();
  }
}

const audio = new File(["abc"], "song.mp3", { type: "audio/mpeg" });

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("putWithProgress", () => {
  test("PUTs the file with Storage headers and reports progress", async () => {
    const progress: number[] = [];
    const done = putWithProgress("https://signed", audio, (r) => progress.push(r));
    const xhr = FakeXHR.last;
    expect(xhr.method).toBe("PUT");
    expect(xhr.url).toBe("https://signed");
    expect(xhr.headers).toMatchObject({
      "content-type": "audio/mpeg",
      "x-upsert": "false",
      apikey: "sb_publishable_test",
    });
    expect(xhr.body).toBe(audio);

    xhr.progress(1, 4);
    xhr.progress(3, 4);
    xhr.finish(200);
    await done;
    expect(progress).toEqual([0.25, 0.75, 1]);
  });

  test.each([
    [413, "too_large"],
    [400, "storage_400"],
  ])("HTTP %d → %s", async (status, code) => {
    const done = putWithProgress("https://signed", audio, () => {});
    FakeXHR.last.finish(status);
    await expect(done).rejects.toMatchObject({ code });
  });

  test("network errors and aborts", async () => {
    const failed = putWithProgress("u", audio, () => {});
    FakeXHR.last.onerror?.();
    await expect(failed).rejects.toMatchObject({ code: "network" });

    const controller = new AbortController();
    const aborted = putWithProgress("u", audio, () => {}, controller.signal);
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ code: "aborted" });
  });
});

describe("uploadAudio", () => {
  test("sign → PUT → complete", async () => {
    const track = { id: "t1", title: "song" };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ trackId: "t1", path: "u/t1.mp3", signedUrl: "https://signed" }),
      )
      .mockResolvedValueOnce(Response.json(track, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = uploadAudio(audio, { title: "Song", origin: "video", durationS: 12 });
    await vi.waitFor(() => expect(FakeXHR.last.url).toBe("https://signed"));
    FakeXHR.last.finish(200);
    await expect(result).resolves.toEqual(track);

    const [signUrl, signInit] = fetchMock.mock.calls[0]!;
    expect(signUrl).toBe("/api/upload/sign");
    expect(JSON.parse(String(signInit?.body))).toEqual({ mime: "audio/mpeg", size: 3 });
    const [completeUrl, completeInit] = fetchMock.mock.calls[1]!;
    expect(completeUrl).toBe("/api/upload/complete");
    expect(JSON.parse(String(completeInit?.body))).toEqual({
      trackId: "t1",
      path: "u/t1.mp3",
      mime: "audio/mpeg",
      size: 3,
      title: "Song",
      artist: null,
      origin: "video",
      durationS: 12,
      folderId: null,
      coverMime: null,
    });
  });

  test("uploads the cover after the audio and reports its type", async () => {
    const cover = new Blob(["img"], { type: "image/png" });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          trackId: "t1",
          path: "u/t1.mp3",
          signedUrl: "https://signed-audio",
          coverSignedUrl: "https://cover",
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "t1" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = uploadAudio(audio, { title: "x", artist: "Neko", origin: "file", cover });
    await vi.waitFor(() => expect(FakeXHR.last.url).toBe("https://signed-audio"));
    FakeXHR.last.finish(200);
    await vi.waitFor(() => expect(FakeXHR.last.url).toBe("https://cover"));
    expect(FakeXHR.last.body).toBe(cover);
    FakeXHR.last.finish(200);
    await result;

    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toMatchObject({
      cover: { mime: "image/png", size: 3 },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toMatchObject({
      artist: "Neko",
      coverMime: "image/png",
    });
  });

  test("a failed cover upload still saves the track, without cover", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ trackId: "t1", path: "p", signedUrl: "a", coverSignedUrl: "b" }),
      )
      .mockResolvedValueOnce(Response.json({ id: "t1" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const cover = new Blob(["img"], { type: "image/jpeg" });
    const result = uploadAudio(audio, { title: "x", origin: "file", cover });
    await vi.waitFor(() => expect(FakeXHR.last.url).toBe("a"));
    FakeXHR.last.finish(200);
    await vi.waitFor(() => expect(FakeXHR.last.url).toBe("b"));
    FakeXHR.last.finish(400);
    await expect(result).resolves.toEqual({ id: "t1" });
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body)).coverMime).toBeNull();
  });

  test("server errors become UploadError codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ error: "too_large" }, { status: 400 })),
    );
    await expect(uploadAudio(audio, { title: "x", origin: "file" })).rejects.toEqual(
      new UploadError("too_large"),
    );
  });

  test("offline → network", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline")));
    await expect(uploadAudio(audio, { title: "x", origin: "file" })).rejects.toMatchObject({
      code: "network",
    });
  });
});
