"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/auth/messages";
import { HOME_PATH, LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { type FieldErrors, parseCredentials, parseRegistration } from "@/lib/auth/validation";
import { lastSeenCookie } from "@/lib/session/config";
import { LAST_SEEN_COOKIE } from "@/lib/session/grace";
import { createClient } from "@/lib/supabase/server";

export interface AuthFormState {
  /** General error shown above the form. */
  error?: string;
  /** Success notice (e.g. "check your email"). */
  notice?: string;
  fieldErrors?: FieldErrors;
  /** Echoed back so the form keeps what the user typed (never the password). */
  values?: { email?: string; username?: string };
}

const field = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

/** Starts the session grace window right after signing in. */
async function startGraceWindow(userId: string) {
  (await cookies()).set(await lastSeenCookie(userId));
}

const requestOrigin = async () => (await headers()).get("origin") ?? "";

export async function signIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: field(form, "email") };
  const parsed = parseCredentials(form);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error.code), values };

  await startGraceWindow(data.user.id);
  redirect(safeNextPath(field(form, "next")));
}

export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const values = { email: field(form, "email"), username: field(form, "username") };
  const parsed = parseRegistration(form);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const { email, password, username } = parsed.data;
  const origin = await requestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  if (error) return { error: authErrorMessage(error.code), values };

  // With email confirmation off, Supabase signs the user in right away.
  if (data.session) {
    await startGraceWindow(data.session.user.id);
    redirect(HOME_PATH);
  }

  return {
    notice: `¡Casi listo! Te enviamos un correo a ${email} para confirmar tu cuenta, nya~`,
  };
}

/** Starts Google OAuth; Google sends the user back to /auth/confirm. */
export async function signInWithGoogle(form: FormData): Promise<void> {
  const next = safeNextPath(field(form, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await requestOrigin()}/auth/confirm?flow=oauth&next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect(`${LOGIN_PATH}?reason=oauth-failed`);
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(LAST_SEEN_COOKIE);
  redirect(`${LOGIN_PATH}?reason=signed-out`);
}
