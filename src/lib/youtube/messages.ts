// User-facing messages are in Spanish (app UI).

/** Search error codes → friendly text. */
export function youtubeSearchErrorMessage(code: string): string {
  switch (code) {
    case "invalid_query":
      return "Escribe algo para buscar (máximo 100 caracteres)";
    case "quota_exhausted":
      return "Se acabó la cuota de búsquedas de YouTube de hoy. Añade tu propia API key en Ajustes y sigue buscando, nya~";
    case "no_key":
      return "YouTube no está configurado. Añade tu propia API key en Ajustes";
    case "unauthorized":
      return "Tu sesión caducó. Vuelve a entrar";
    default:
      return "No se pudo buscar en YouTube. ¿Hay internet?";
  }
}

/** Warning when the user's own key failed and another source answered. */
export function userKeyProblemMessage(problem: "quota" | "invalid_key"): string {
  return problem === "quota"
    ? "Tu API key de YouTube no tiene cuota hoy: he usado la compartida"
    : "Tu API key de YouTube ya no funciona: revísala en Ajustes";
}

/** Saving/removing the user's key → friendly text. */
export function youtubeKeyErrorMessage(code: string): string {
  switch (code) {
    case "invalid_format":
      return "Eso no parece una API key de Google (empieza por «AIza» y tiene 39 caracteres)";
    case "invalid_key":
      return "Google rechazó esa key. ¿Activaste «YouTube Data API v3» en tu proyecto?";
    case "verify_failed":
      return "No se pudo comprobar la key con Google. Inténtalo otra vez";
    case "server_config":
      return "El servidor no tiene configurado el cifrado (ENCRYPTION_KEY)";
    case "unauthorized":
      return "Tu sesión caducó. Vuelve a entrar";
    default:
      return "No se pudo guardar. Inténtalo otra vez";
  }
}
