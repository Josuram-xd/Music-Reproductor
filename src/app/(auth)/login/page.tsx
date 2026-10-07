import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { loginReasonMessage } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "Iniciar sesión · Purrlist" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h2 className="mb-5 font-display text-2xl font-semibold">¡Hola de nuevo! 🐾</h2>
      {/* searchParams is request data, so it streams in (Cache Components). */}
      <Suspense fallback={<LoginForm />}>
        <LoginWithParams searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginWithParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return <LoginForm next={first(params.next)} notice={loginReasonMessage(first(params.reason))} />;
}
