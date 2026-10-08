// User-facing messages are in Spanish (app UI).

/** Saving a video to the library → friendly text. */
export function saveVideoErrorMessage(code: string): string {
  switch (code) {
    case "not_found":
      return "Esa carpeta ya no existe. Recarga la página";
    case "unauthorized":
      return "Tu sesión caducó. Vuelve a entrar";
    default:
      return "No se pudo guardar el vídeo. Inténtalo otra vez";
  }
}

export const SAVE_VIDEO_MESSAGES = {
  saved: (folder: string) => `¡Nya~! Guardado en ${folder}`,
  moved: (folder: string) => `Ya lo tenías: ahora está en ${folder}`,
} as const;
