"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthFormState, signIn } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { REGISTER_PATH } from "@/lib/auth/routes";
import { FormMessage } from "./form-message";
import { GoogleButton, OrDivider } from "./google-button";

interface LoginFormProps {
  /** Where to go after signing in (sanitized again on the server). */
  next?: string;
  /** Notice from `?reason=` (expired session, signed out…). */
  notice?: string;
}

export function LoginForm({ next = "", notice }: LoginFormProps) {
  const [state, action, pending] = useActionState(signIn, {} as AuthFormState);

  return (
    <div className="flex flex-col gap-4">
      {state.error ? (
        <FormMessage tone="error">{state.error}</FormMessage>
      ) : notice ? (
        <FormMessage tone="notice">{notice}</FormMessage>
      ) : null}

      <GoogleButton next={next} />
      <OrDivider />

      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <TextField
          name="email"
          label="Correo"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
        <TextField
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />

        <Button type="submit" pending={pending} className="mt-2">
          {pending ? "Entrando…" : "Entrar 🐾"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        ¿Aún no tienes cuenta?{" "}
        <Link href={REGISTER_PATH} className="font-semibold text-secondary hover:underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
