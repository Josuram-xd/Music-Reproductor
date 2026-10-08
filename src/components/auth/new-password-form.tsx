"use client";

import { useActionState } from "react";
import { type AuthFormState, updatePassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { FormMessage } from "./form-message";

export function NewPasswordForm({ next = "" }: { next?: string }) {
  const [state, action, pending] = useActionState(updatePassword, {} as AuthFormState);

  return (
    <div className="flex flex-col gap-4">
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      <p className="text-sm text-muted">Elige una contraseña nueva para tu cuenta.</p>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <TextField
          name="password"
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          error={state.fieldErrors?.password}
          hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con letras y números`}
        />
        <TextField
          name="confirmPassword"
          label="Confirma la contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          error={state.fieldErrors?.confirmPassword}
        />
        <Button type="submit" pending={pending} className="mt-2">
          {pending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </div>
  );
}
