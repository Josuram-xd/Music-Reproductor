"use client";

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";

/** How long the widget stays fully opaque after the last touch. */
export const TOUCH_AWAKE_MS = 4000;

/**
 * Touch screens have no hover: a tap "wakes" the element (fully opaque) and
 * it fades back after `ms` without touches. Mouse/pen use CSS hover instead.
 */
export function useTouchAwake(ms = TOUCH_AWAKE_MS) {
  const [awake, setAwake] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      setAwake(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setAwake(false), ms);
    },
    [ms],
  );

  return { awake, onPointerDown };
}
