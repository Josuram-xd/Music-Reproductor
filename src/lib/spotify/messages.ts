// User-facing messages are in Spanish (app UI).
import type { SpotifyConnectStatus } from "./config";

/** Result of the OAuth round trip (`/settings?spotify=…`). */
export const CONNECT_MESSAGES: Record<SpotifyConnectStatus, { text: string; ok: boolean }> = {
  connected: { text: "¡Nya~! Spotify conectado 🎧", ok: true },
  denied: { text: "Cancelaste la conexión con Spotify", ok: false },
  no_client_id: { text: "Primero pega el Client ID de tu app de Spotify", ok: false },
  state_mismatch: {
    text: "La conexión caducó o vino de otra pestaña. Vuelve a pulsar «Conectar»",
    ok: false,
  },
  invalid_client: {
    text: "Spotify no reconoce ese Client ID o la Redirect URI no coincide. Revisa los pasos",
    ok: false,
  },
  failed: { text: "No se pudo conectar con Spotify. Inténtalo otra vez", ok: false },
};

/** Saving the Client ID / disconnecting → friendly text. */
export function spotifySettingErrorMessage(code: string): string {
  switch (code) {
    case "invalid_client_id":
      return "Eso no parece un Client ID (son 32 letras y números)";
    case "unauthorized":
      return "Tu sesión caducó. Vuelve a entrar";
    default:
      return "No se pudo guardar. Inténtalo otra vez";
  }
}

/** Search / token error codes → friendly text. */
export function spotifySearchErrorMessage(code: string): string {
  switch (code) {
    case "invalid_query":
      return "Escribe algo para buscar (máximo 100 caracteres)";
    case "not_connected":
      return "Conecta tu cuenta de Spotify en Ajustes para buscar aquí 🐾";
    case "reauth":
      return "Spotify pide que vuelvas a conectar tu cuenta en Ajustes";
    case "forbidden":
      return "Spotify no deja usar la app con tu cuenta: añade tu email en «User Management» de tu app";
    case "rate_limited":
      return "Demasiadas búsquedas seguidas. Espera un momento, nya~";
    case "unauthorized":
      return "Tu sesión caducó. Vuelve a entrar";
    default:
      return "No se pudo buscar en Spotify. ¿Hay internet?";
  }
}

/** Whether a Spotify account can play in the browser. */
export const isPremium = (product: string | null) => product === "premium";
