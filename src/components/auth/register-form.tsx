"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthFormState, signUp } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { LOGIN_PATH } from "@/lib/auth/routes";
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/auth/validation";
import { FormMessage } from "./form-message";

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, {} as AuthFormState);

  if (state.notice) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="notice">{state.notice}</FormMessage>
        <Link
          href={LOGIN_PATH}
          className="text-center text-sm font-semibold text-secondary hover:underline"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <TextField
        name="username"
        label="Nombre"
        autoComplete="nickname"
        required
        minLength={USERNAME_MIN_LENGTH}
        maxLength={USERNAME_MAX_LENGTH}
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
        hint="Así te saludará Purrlist"
      />
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
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        error={state.fieldErrors?.password}
        hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con letras y números`}
      />

      <Button type="submit" pending={pending} className="mt-2">
        {pending ? "Creando cuenta…" : "Crear cuenta 🐾"}
      </Button>

      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={LOGIN_PATH} className="font-semibold text-secondary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
