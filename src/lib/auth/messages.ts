// User-facing messages are in Spanish (app UI).

/** Maps a Supabase Auth error code to a friendly message. */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos, nya~";
    case "email_not_confirmed":
      return "Aún no confirmas tu correo. Revisa tu bandeja de entrada 📬";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese correo. ¿Quieres iniciar sesión?";
    case "weak_password":
      return "Esa contraseña es muy débil, prueba con una más larga";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera un momento y vuelve a probar 🐾";
    case "signup_disabled":
      return "El registro está desactivado ahora mismo";
    default:
      return "Algo salió mal, inténtalo otra vez";
  }
}

/** Notice shown on /login for a `?reason=` query param. */
export function loginReasonMessage(reason: string | undefined): string | undefined {
  switch (reason) {
    case "expired":
      return "Tu sesión caducó. Vuelve a entrar, nya~";
    case "signed-out":
      return "Sesión cerrada. ¡Hasta pronto! 🐾";
    case "confirm-failed":
      return "El enlace de confirmación no es válido o ya caducó";
    default:
      return undefined;
  }
}
