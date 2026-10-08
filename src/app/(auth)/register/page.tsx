import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta · Purrlist" };

export default function RegisterPage() {
  return (
    <>
      <h2 className="mb-5 font-display text-2xl font-semibold">Crea tu cuenta</h2>
      <RegisterForm />
    </>
  );
}
