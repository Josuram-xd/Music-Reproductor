// User-facing messages are in Spanish (app UI).
import type { RepeatMode } from "./player-engine";
import type { PlaybackError } from "./types";

export const FIRST_TRACK_MESSAGE = "Es la primera canción, nya~ 🐾";

export const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: "Repetir: no",
  all: "Repetir: toda la cola",
  one: "Repetir: esta canción",
};

export function playbackErrorMessage(error: PlaybackError): string {
  switch (error.code) {
    case "not-allowed":
      return "El navegador pausó la música. Pulsa ▶ para seguir 🐾";
    case "network":
      return "No se pudo cargar la canción. ¿Hay internet?";
    case "decode":
      return "Ese archivo parece dañado, nya~";
    case "unsupported":
      return "Esta canción no se puede reproducir aquí";
    case "account":
      return "Spotify necesita una cuenta Premium (y estar conectado en Ajustes) para sonar aquí 🐾";
    default:
      return "Algo falló al reproducir. Inténtalo otra vez";
  }
}

export const QUEUE_MESSAGES = {
  added: "¡Nya~! Canción añadida a la cola",
  alreadyQueued: "Esa canción ya está en la cola, nya~",
  undone: (label?: string) =>
    label === "insert"
      ? "↩️ Deshecho: canción quitada de la cola"
      : label === "insertMany"
        ? "↩️ Deshecho: canciones quitadas de la cola"
        : label === "remove"
          ? "↩️ Deshecho: vuelven a la cola"
          : label === "playNow"
            ? "↩️ Deshecho: vuelve la canción de antes"
            : "↩️ Deshecho: la cola vuelve a como estaba",
  redone: (label?: string) =>
    label === "insert"
      ? "↪️ Rehecho: canción añadida otra vez"
      : label === "insertMany"
        ? "↪️ Rehecho: canciones añadidas otra vez"
        : label === "remove"
          ? "↪️ Rehecho: quitadas otra vez"
          : label === "playNow"
            ? "↪️ Rehecho: suena otra vez la elegida"
            : "↪️ Rehecho: cambio de la cola aplicado otra vez",
  nothingToUndo: "No hay nada que deshacer en la cola, nya~",
  nothingToRedo: "No hay nada que rehacer en la cola, nya~",
} as const;

/** Texts of the "dropped on top of the current track" flow (docs/ARCHITECTURE.md). */
export const DROP_MESSAGES = {
  undo: "↩️ Deshacer",
  applied: {
    playNow: (title: string) => `Sonando ahora: ${title}`,
    playNext: (title: string) => `${title} va a continuación`,
  },
  remembered: "Vale, no volveré a preguntar en esta sesión. Puedes reactivarlo en Ajustes 🐾",
} as const;

export const FLOATING_MESSAGES = {
  closed: "Mini-reproductor oculto. Puedes volver a activarlo en Ajustes 🐾",
  pipFailed: "No se pudo sacar el reproductor de la ventana",
} as const;

/** Neko radio texts. */
export const RADIO_MESSAGES = {
  badge: "Recomendada",
  added: (count: number) =>
    `🐾 La radio neko añadió ${count === 1 ? "una canción" : `${count} canciones`}`,
  disliked: (artist: string) => `Vale, menos ${artist} en la radio 🐾`,
  dislikeFailed: "No se pudo guardar tu «No me gusta». Inténtalo otra vez",
  on: "Radio neko activada: cuando se acabe la cola, sigo yo 🐾",
  off: "Radio neko desactivada",
} as const;
