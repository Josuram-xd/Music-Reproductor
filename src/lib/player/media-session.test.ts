import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bindMediaSession, type MediaSessionHandlers, syncMediaSession } from "./media-session";
import type { PlayerSnapshot } from "./player-engine";

class FakeMediaMetadata {
  title: string;
  artist: string;
  album: string;
  constructor(init: { title: string; artist: string; album: string }) {
    this.title = init.title;
    this.artist = init.artist;
    this.album = init.album;
  }
}

/** Fake `navigator.mediaSession`. `unsupported` actions throw like real browsers. */
function fakeSession(unsupported: string[] = []) {
  const handlers = new Map<string, MediaSessionActionHandler | null>();
  const session = {
    metadata: null as MediaMetadata | null,
    playbackState: "none" as MediaSessionPlaybackState,
    setActionHandler: vi.fn((action: string, handler: MediaSessionActionHandler | null) => {
      if (unsupported.includes(action)) throw new TypeError(`${action} not supported`);
      handlers.set(action, handler);
    }),
    setPositionState: vi.fn(),
  };
  const fire = (action: string, details: Partial<MediaSessionActionDetails> = {}) =>
    handlers.get(action)?.({ action, ...details } as MediaSessionActionDetails);
  return { session: session as unknown as MediaSession, raw: session, handlers, fire };
}

const handlers = (): MediaSessionHandlers => ({
  play: vi.fn(),
  pause: vi.fn(),
  previous: vi.fn(),
  next: vi.fn(),
  seekBy: vi.fn(),
  seekTo: vi.fn(),
});

const snapshot = (overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({
  current: { id: "t1", source: "audio", title: "Neko Lofi", artist: "Mochi" },
  queue: [],
  state: "playing",
  time: 30,
  duration: 180,
  volume: 1,
  muted: false,
  repeat: "off",
  hasPrevious: false,
  hasNext: false,
  ...overrides,
});

beforeEach(() => vi.stubGlobal("MediaMetadata", FakeMediaMetadata));
afterEach(() => vi.unstubAllGlobals());

describe("bindMediaSession", () => {
  test("routes system media buttons to the player", () => {
    const { session, fire } = fakeSession();
    const h = handlers();
    bindMediaSession(session, h);

    fire("play");
    fire("pause");
    fire("previoustrack");
    fire("nexttrack");
    fire("seekbackward");
    fire("seekforward", { seekOffset: 5 });
    fire("seekto", { seekTime: 90 });
    fire("seekto", {});

    expect(h.play).toHaveBeenCalledOnce();
    expect(h.pause).toHaveBeenCalledOnce();
    expect(h.previous).toHaveBeenCalledOnce();
    expect(h.next).toHaveBeenCalledOnce();
    expect(h.seekBy).toHaveBeenNthCalledWith(1, -10);
    expect(h.seekBy).toHaveBeenNthCalledWith(2, 5);
    expect(h.seekTo).toHaveBeenCalledExactlyOnceWith(90);
  });

  test("skips actions the browser does not support", () => {
    const { session, handlers: bound } = fakeSession(["seekto"]);
    expect(() => bindMediaSession(session, handlers())).not.toThrow();
    expect(bound.has("seekto")).toBe(false);
    expect(bound.has("play")).toBe(true);
  });

  test("cleanup removes the handlers", () => {
    const { session, handlers: bound } = fakeSession();
    const unbind = bindMediaSession(session, handlers());
    unbind();
    expect([...bound.values()].every((h) => h === null)).toBe(true);
  });
});

describe("syncMediaSession", () => {
  test("publishes metadata, play state and position", () => {
    const { session, raw } = fakeSession();
    syncMediaSession(session, snapshot());
    expect(session.metadata).toMatchObject({
      title: "Neko Lofi",
      artist: "Mochi",
      album: "Purrlist",
    });
    expect(session.playbackState).toBe("playing");
    expect(raw.setPositionState).toHaveBeenCalledWith({
      duration: 180,
      playbackRate: 1,
      position: 30,
    });
  });

  test("keeps the metadata object while the track is the same", () => {
    const { session } = fakeSession();
    syncMediaSession(session, snapshot());
    const first = session.metadata;
    syncMediaSession(session, snapshot({ time: 31, state: "paused" }));
    expect(session.metadata).toBe(first);
    expect(session.playbackState).toBe("paused");
  });

  test("clears everything when nothing is loaded", () => {
    const { session } = fakeSession();
    syncMediaSession(session, snapshot());
    syncMediaSession(session, snapshot({ current: null }));
    expect(session.metadata).toBeNull();
    expect(session.playbackState).toBe("none");
  });

  test("skips the position while the duration is unknown and clamps it", () => {
    const { session, raw } = fakeSession();
    syncMediaSession(session, snapshot({ duration: 0 }));
    expect(raw.setPositionState).not.toHaveBeenCalled();
    syncMediaSession(session, snapshot({ time: 999 }));
    expect(raw.setPositionState).toHaveBeenLastCalledWith(
      expect.objectContaining({ position: 180 }),
    );
  });

  test("a throwing setPositionState is harmless", () => {
    const { session, raw } = fakeSession();
    raw.setPositionState.mockImplementation(() => {
      throw new TypeError("bad state");
    });
    expect(() => syncMediaSession(session, snapshot())).not.toThrow();
  });
});
