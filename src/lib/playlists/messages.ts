// User-facing messages are in Spanish (app UI).

/** Playlist action error codes → friendly text. */
export function playlistErrorMessage(code: string): string {
  switch (code) {
    case "invalid_name":
      return "El nombre debe tener entre 1 y 100 caracteres";
    case "not_found":
      return "Esa playlist o canción ya no existe. Recarga la página";
    case "unauthorized":
      return "Tu sesión caducó. Vuelve a entrar";
    default:
      return "No se pudo guardar el cambio. Inténtalo otra vez";
  }
}

export const PLAYLIST_MESSAGES = {
  created: (name: string) => `¡Nya~! Playlist «${name}» creada`,
  added: (count: number, name: string) =>
    count === 0
      ? `Ya estaba en «${name}», nya~`
      : `${count === 1 ? "Canción añadida" : `${count} canciones añadidas`} a «${name}» 🐾`,
  savedQueue: (name: string) => `Cola guardada como «${name}» 🐾`,
  emptyQueue: "La cola está vacía: no hay nada que guardar, nya~",
  queued: (count: number) =>
    count === 0
      ? "Ya estaban todas en la cola, nya~"
      : `${count === 1 ? "Canción añadida" : `${count} canciones añadidas`} a la cola`,
  empty: "Esta playlist está vacía, nya~",
} as const;
