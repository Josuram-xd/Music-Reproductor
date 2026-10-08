import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { safeNextPath } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Nueva contraseña · Purrlist" };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <>
      <h2 className="mb-5 font-display text-2xl font-semibold">Crea una nueva contraseña</h2>
      <Suspense fallback={<NewPasswordForm />}>
        <NewPasswordFormWithParams searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewPasswordFormWithParams({
  searchParams,
}: Pick<PageProps<"/reset-password">, "searchParams">) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  return <NewPasswordForm next={safeNextPath(next)} />;
}
