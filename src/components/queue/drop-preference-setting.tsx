"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { DropChoice } from "@/lib/player/queue-commands";
import { queue, useQueueStore } from "@/stores/queue-store";

const CHOICE_LABELS: Record<DropChoice, string> = {
  playNow: "reproducir ahora",
  playNext: "ponerla a continuación",
};

/** Turns the "dropped on the current track" question back on (Ajustes). */
export function DropPreferenceSetting() {
  const preference = useQueueStore((s) => s.dropPreference);

  // sessionStorage only exists in the browser: read it after hydration.
  useEffect(() => queue.syncPreference(), []);

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 @tablet:flex-row @tablet:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Preguntar al soltar encima de la que suena</p>
        <p className="text-sm text-muted">
          {preference
            ? `Ahora mismo no pregunta: siempre elige «${CHOICE_LABELS[preference]}» hasta que cierres sesión.`
            : "Activado: te preguntaremos qué hacer cada vez, nya~"}
        </p>
      </div>
      {preference ? (
        <Button type="button" onClick={queue.resetDropPreference} className="shrink-0">
          Volver a preguntar
        </Button>
      ) : null}
    </div>
  );
}
