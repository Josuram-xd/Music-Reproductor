"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthFormState, requestPasswordReset } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { FormMessage } from "./form-message";

export function ForgotPasswordForm({ next = "" }: { next?: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, {} as AuthFormState);

  if (state.notice) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="notice">{state.notice}</FormMessage>
        <Link
          href={LOGIN_PATH}
          className="text-center text-sm font-semibold text-secondary hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <p className="text-sm text-muted">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña.
      </p>
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
        <Button type="submit" pending={pending} className="mt-2">
          {pending ? "Enviando enlace…" : "Enviar enlace"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        ¿Recordaste la contraseña?{" "}
        <Link href={LOGIN_PATH} className="font-semibold text-secondary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
