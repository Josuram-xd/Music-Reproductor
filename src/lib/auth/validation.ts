// User-facing messages are in Spanish (app UI); everything else in English.

export const PASSWORD_MIN_LENGTH = 8;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export type Field = "email" | "password" | "username";
export type FieldErrors = Partial<Record<Field, string>>;

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  username: string;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

function emailError(email: string): string | undefined {
  if (!email) return "Escribe tu correo, nya~";
  if (!EMAIL_PATTERN.test(email)) return "Ese correo no parece válido";
  return undefined;
}

export function parseCredentials(form: FormData): ValidationResult<Credentials> {
  const email = text(form, "email").trim().toLowerCase();
  const password = text(form, "password");
  const errors: FieldErrors = {};

  const emailMessage = emailError(email);
  if (emailMessage) errors.email = emailMessage;
  if (!password) errors.password = "Escribe tu contraseña";

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data: { email, password } };
}

export function parseRegistration(form: FormData): ValidationResult<Registration> {
  const email = text(form, "email").trim().toLowerCase();
  const password = text(form, "password");
  const username = text(form, "username").trim();
  const errors: FieldErrors = {};

  const emailMessage = emailError(email);
  if (emailMessage) errors.email = emailMessage;

  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    errors.username = `Tu nombre debe tener entre ${USERNAME_MIN_LENGTH} y ${USERNAME_MAX_LENGTH} caracteres`;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = "Usa letras y números en la contraseña";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data: { email, password, username } };
}
