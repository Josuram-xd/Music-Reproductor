import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <Suspense fallback={<div className="h-12 w-64 animate-pulse rounded-2xl bg-surface" />}>
        <Greeting />
      </Suspense>
      <p className="text-muted">Tu reproductor musical kawaii está en construcción, nya~ 🐾</p>
    </main>
  );
}

async function Greeting() {
  const user = await requireUser();
  return (
    <h1 className="font-display text-4xl font-semibold text-primary">
      ¡Hola, {user.username ?? "gatito"}!
    </h1>
  );
}
