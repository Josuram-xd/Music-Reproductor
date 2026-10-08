import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña · Purrlist" };

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <>
      <h2 className="mb-5 font-display text-2xl font-semibold">Recupera tu cuenta</h2>
      <Suspense fallback={<ForgotPasswordForm />}>
        <ForgotPasswordFormWithParams searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ForgotPasswordFormWithParams({
  searchParams,
}: Pick<PageProps<"/forgot-password">, "searchParams">) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  return <ForgotPasswordForm next={next} />;
}
