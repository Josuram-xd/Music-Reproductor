// User-facing messages are in Spanish (app UI).

/** Folder/track action error codes → friendly text. */
export function folderErrorMessage(code: string): string {
  switch (code) {
    case "invalid_name":
      return "El nombre debe tener entre 1 y 100 caracteres";
    case "cycle":
      return "Una carpeta no puede ir dentro de sí misma, nya~";
    case "not_found":
      return "Esa carpeta ya no existe. Recarga la página";
    case "unauthorized":
      return "Tu sesión caducó. Vuelve a entrar";
    default:
      return "No se pudo guardar el cambio. Inténtalo otra vez";
  }
}

/** Upload/extraction error codes → friendly text. */
export function uploadErrorMessage(code: string): string {
  switch (code) {
    case "too_large":
      return "Pasa de 50 MB, el límite por archivo";
    case "unsupported_type":
      return "Formato de audio no compatible";
    case "no-audio":
      return "Ese vídeo no tiene sonido, nya~";
    case "load-failed":
      return "No se pudo cargar el extractor de audio. ¿Hay internet?";
    case "failed":
      return "No se pudo sacar el audio del vídeo";
    case "network":
      return "Se cortó la conexión. Inténtalo otra vez";
    case "unauthorized":
      return "Tu sesión caducó. Vuelve a entrar";
    case "aborted":
      return "Subida cancelada";
    default:
      return "Algo falló al subir. Inténtalo otra vez";
  }
}
