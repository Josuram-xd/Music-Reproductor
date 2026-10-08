/** "2 h 05 min", "12 min", "45 s": durations for KPI cards. */
export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** "1:02:07" / "4:32": a live clock (current session). */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "1 día" / "5 días". */
export function formatDays(days: number): string {
  return `${days} ${days === 1 ? "día" : "días"}`;
}

/** An IANA time zone Postgres and the browser agree on, or "UTC". */
export function cleanTimeZone(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_+\-/]{1,64}$/.test(value)) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

/** The browser's time zone (stats days and hours are local). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
