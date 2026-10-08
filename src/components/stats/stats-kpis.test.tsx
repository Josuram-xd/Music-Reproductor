import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { StatsSummary } from "@/lib/stats/summary";
import { StatsKpis } from "./stats-kpis";

const summary: StatsSummary = {
  listenedS: 2 * 3600 + 5 * 60,
  plays: 42,
  bySource: { audio: 0, youtube: 0, spotify: 0 },
  usageS: 600,
  sessionStartedAt: null,
  streakDays: 3,
};
const reply = (body: unknown, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("StatsKpis", () => {
  test("asks for the summary in the browser's time zone and shows the cards", async () => {
    const fetch = reply(summary);
    render(<StatsKpis />);
    const cards = await screen.findByRole("list", { name: "Resumen" });
    expect(String(fetch.mock.calls[0]![0])).toMatch(/^\/api\/stats\/summary\?tz=/);
    expect(within(cards).getByText("2 h 05 min")).toBeInTheDocument();
    expect(within(cards).getByText("42 reproducciones")).toBeInTheDocument();
    expect(within(cards).getByText("10 min")).toBeInTheDocument();
    expect(within(cards).getByText("3 días")).toBeInTheDocument();
    expect(within(cards).getByText("—")).toBeInTheDocument();
  });

  test("the current session counts live", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(Date.parse("2026-10-07T10:04:32Z"));
    reply({ ...summary, sessionStartedAt: "2026-10-07T10:00:00Z" });
    render(<StatsKpis />);
    expect(await screen.findByText("4:32")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText("4:35")).toBeInTheDocument();
    expect(screen.getByText("En vivo")).toBeInTheDocument();
  });

  test("errors are explained", async () => {
    reply({ error: "failed" }, 500);
    render(<StatsKpis />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudieron cargar/);
  });
});
