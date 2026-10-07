import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HEARTBEAT_URL, SessionKeeper } from "./session-keeper";

const auth = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
  refreshSession: vi.fn(async () => ({ data: {}, error: null })),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

const navigation = vi.hoisted(() => ({ hardNavigate: vi.fn() }));
vi.mock("@/lib/browser/navigation", () => navigation);

const fetchMock = vi.fn<typeof fetch>();
const respond = (status: number) => fetchMock.mockResolvedValue(new Response("{}", { status }));
const fail = () => fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

/** Advances fake time and flushes the promises it triggers. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  respond(200);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SessionKeeper", () => {
  test("renders nothing and sends a heartbeat every 30 s", async () => {
    const { container } = render(<SessionKeeper graceSeconds={300} />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(HEARTBEAT_URL, {
      method: "POST",
      cache: "no-store",
    });
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container).toBeEmptyDOMElement();
  });

  test("going offline shows the overlay with a live countdown", async () => {
    render(<SessionKeeper graceSeconds={300} />);
    fail();
    await act(async () => fireEvent(window, new Event("offline")));

    expect(screen.getByText("Reconectando…")).toBeInTheDocument();
    expect(screen.getByText("5:00")).toBeInTheDocument();
    await advance(28_000);
    expect(screen.getByText("4:32")).toBeInTheDocument();
  });

  test("a failed heartbeat also starts reconnecting", async () => {
    render(<SessionKeeper graceSeconds={300} />);
    respond(503);
    await advance(30_000);
    expect(screen.getByText("Reconectando…")).toBeInTheDocument();
  });

  test("coming back online refreshes the token and hides the overlay", async () => {
    render(<SessionKeeper graceSeconds={300} />);
    fail();
    await act(async () => fireEvent(window, new Event("offline")));
    expect(screen.getByRole("status")).toBeInTheDocument();

    respond(200);
    await act(async () => fireEvent(window, new Event("online")));
    expect(auth.refreshSession).toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("keeps retrying while reconnecting and recovers on its own", async () => {
    render(<SessionKeeper graceSeconds={300} />);
    fail();
    await act(async () => fireEvent(window, new Event("offline")));

    respond(200);
    await advance(5_000);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("the Retry button tries again right away", async () => {
    render(<SessionKeeper graceSeconds={300} />);
    fail();
    await act(async () => fireEvent(window, new Event("offline")));

    respond(200);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reintentar" })));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("signs out when the countdown reaches zero", async () => {
    render(<SessionKeeper graceSeconds={10} />);
    fail();
    await act(async () => fireEvent(window, new Event("offline")));

    await advance(10_000);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(navigation.hardNavigate).toHaveBeenCalledExactlyOnceWith("/login?reason=expired");
    expect(screen.getByText("Cerrando sesión…")).toBeInTheDocument();
  });

  test("signs out when the server says the session expired", async () => {
    render(<SessionKeeper graceSeconds={300} />);
    respond(401);
    await advance(30_000);
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(navigation.hardNavigate).toHaveBeenCalledWith("/login?reason=expired");

    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("checks in as soon as the tab becomes visible again", async () => {
    render(<SessionKeeper graceSeconds={300} />);
    await act(async () => fireEvent(document, new Event("visibilitychange")));
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
