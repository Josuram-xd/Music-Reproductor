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
    default:
      return "Algo falló al reproducir. Inténtalo otra vez";
  }
}
