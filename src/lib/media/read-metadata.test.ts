import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { probeDuration, readMetadata } from "./read-metadata";

const latin1 = (text: string) => [...text].map((c) => c.charCodeAt(0));
const syncsafe = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const frame = (id: string, body: number[]) => [
  ...latin1(id),
  ...syncsafe(body.length),
  0,
  0,
  ...body,
];

function mp3WithTag(frames: number[][]): File {
  const body = frames.flat();
  const tag = [...latin1("ID3"), 4, 0, 0, ...syncsafe(body.length), ...body];
  return new File([new Uint8Array([...tag, 0xff, 0xfb, 0x90, 0x00])], "x.mp3", {
    type: "audio/mpeg",
  });
}

/** `<audio>` stand-in: setting `src` fires the given outcome on the next tick. */
function fakeAudio(outcome: { duration: number } | "error" | "never") {
  const audio = {
    preload: "",
    duration: NaN,
    onloadedmetadata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    removeAttribute: vi.fn(),
    load: vi.fn(),
    set src(_url: string) {
      if (outcome === "never") return;
      setTimeout(() => {
        if (outcome === "error") audio.onerror?.();
        else {
          audio.duration = outcome.duration;
          audio.onloadedmetadata?.();
        }
      });
    },
  };
  vi.spyOn(document, "createElement").mockReturnValue(audio as unknown as HTMLElement);
  return audio;
}

beforeEach(() => {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("probeDuration", () => {
  test("reads the duration the browser decodes", async () => {
    fakeAudio({ duration: 183.4 });
    await expect(probeDuration(new Blob(["x"]))).resolves.toBe(183.4);
  });

  test.each([{ duration: Infinity }, "error" as const])("unknown → null (%j)", async (outcome) => {
    fakeAudio(outcome);
    await expect(probeDuration(new Blob(["x"]))).resolves.toBeNull();
  });

  test("gives up after the timeout", async () => {
    vi.useFakeTimers();
    fakeAudio("never");
    const result = probeDuration(new Blob(["x"]), 1000);
    vi.advanceTimersByTime(1000);
    await expect(result).resolves.toBeNull();
  });
});

describe("readMetadata", () => {
  test("title, artist, duration and a valid cover", async () => {
    fakeAudio({ duration: 61 });
    const jpeg = [0xff, 0xd8, 0xff, 0x01];
    const file = mp3WithTag([
      frame("TIT2", [3, ...latin1("Nyan")]),
      frame("TPE1", [3, ...latin1("Neko Band")]),
      frame("APIC", [0, ...latin1("image/jpeg"), 0, 3, 0, ...jpeg]),
    ]);

    const meta = await readMetadata(file);
    expect(meta).toMatchObject({ title: "Nyan", artist: "Neko Band", durationS: 61 });
    expect(meta.cover?.type).toBe("image/jpeg");
    expect(new Uint8Array(await meta.cover!.arrayBuffer())).toEqual(new Uint8Array(jpeg));
  });

  test("drops covers the bucket would reject", async () => {
    fakeAudio({ duration: 1 });
    const file = mp3WithTag([frame("APIC", [0, ...latin1("image/gif"), 0, 3, 0, 1, 2])]);
    expect((await readMetadata(file)).cover).toBeNull();
  });

  test("files without tags only get the duration", async () => {
    fakeAudio({ duration: 5 });
    const meta = await readMetadata(new File([new Uint8Array([0xff, 0xfb, 0x90])], "a.mp3"));
    expect(meta).toEqual({ title: null, artist: null, durationS: 5, cover: null });
  });
});
