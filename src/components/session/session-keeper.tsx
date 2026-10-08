"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { hardNavigate } from "@/lib/browser/navigation";
import { formatCountdown, graceRemaining, HEARTBEAT_INTERVAL_MS } from "@/lib/session/grace";
import { createClient } from "@/lib/supabase/client";
import { PixelCat } from "@/components/ui/pixel/pixel";

export const HEARTBEAT_URL = "/api/session/heartbeat";
const RETRY_INTERVAL_MS = 5_000;

type Status = "alive" | "reconnecting" | "expired";

interface SessionKeeperProps {
  graceSeconds: number;
}

/**
 * Keeps the session grace window alive: sends a heartbeat every 30 s and,
 * while the network is down, shows a "Reconnecting…" overlay with the time
 * left. Audio already buffered keeps playing underneath. If the grace runs
 * out (or the server says the session expired), it signs out cleanly.
 */
export function SessionKeeper({ graceSeconds }: SessionKeeperProps) {
  const [status, setStatus] = useState<Status>("alive");
  const [remaining, setRemaining] = useState(graceSeconds);
  const lastAlive = useRef(0);
  const statusRef = useRef<Status>("alive");

  const update = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const expire = useCallback(async () => {
    if (statusRef.current === "expired") return;
    update("expired");
    // Local sign-out works offline: it drops the session cookies in this browser.
    await createClient()
      .auth.signOut({ scope: "local" })
      .catch(() => undefined);
    hardNavigate(`${LOGIN_PATH}?reason=expired`);
  }, [update]);

  const heartbeat = useCallback(async () => {
    if (statusRef.current === "expired") return;
    try {
      const response = await fetch(HEARTBEAT_URL, { method: "POST", cache: "no-store" });
      if (response.status === 401) return void (await expire());
      if (!response.ok) throw new Error(`Heartbeat failed: ${response.status}`);
      lastAlive.current = Date.now();
      update("alive");
    } catch {
      update("reconnecting");
    }
  }, [expire, update]);

  const recover = useCallback(async () => {
    // Back online: refresh the Supabase token first, then renew the window.
    await createClient()
      .auth.refreshSession()
      .catch(() => undefined);
    await heartbeat();
  }, [heartbeat]);

  // Regular heartbeat, plus an immediate one when the tab comes back.
  useEffect(() => {
    // The page was just served, so the proxy renewed the window right now.
    lastAlive.current = Date.now();
    const interval = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    const onOffline = () => update("reconnecting");
    const onOnline = () => void recover();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [heartbeat, recover, update]);

  // While reconnecting: count down every second and retry every few seconds.
  useEffect(() => {
    if (status !== "reconnecting") return;
    const tick = () => {
      const left = graceRemaining(lastAlive.current, Date.now(), graceSeconds);
      setRemaining(left);
      if (left === 0) void expire();
    };
    tick();
    const countdown = setInterval(tick, 1_000);
    const retry = setInterval(() => void recover(), RETRY_INTERVAL_MS);
    return () => {
      clearInterval(countdown);
      clearInterval(retry);
    };
  }, [status, graceSeconds, expire, recover]);

  if (status === "alive") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-xs rounded-3xl border-2 border-surface-2 bg-surface p-6 text-center shadow-pixel"
      >
        <PixelCat
          mood={status === "expired" ? "sad" : "sleepy"}
          className="mx-auto w-16 motion-safe:animate-pulse"
        />
        {status === "expired" ? (
          <p className="mt-3 font-display text-xl font-semibold">Cerrando sesión…</p>
        ) : (
          <>
            <p className="mt-3 font-display text-xl font-semibold">Reconectando…</p>
            <p className="mt-1 text-sm text-muted">
              Tu sesión sigue viva{" "}
              <span className="font-semibold text-secondary tabular-nums">
                {formatCountdown(remaining)}
              </span>
            </p>
            <Button variant="ghost" className="mt-4" onClick={() => void recover()}>
              Reintentar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
