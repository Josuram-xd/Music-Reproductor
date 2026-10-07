import { ForgetSessionChoices } from "@/components/auth/forget-session-choices";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <p aria-hidden className="text-4xl">
            🐱
          </p>
          <h1 className="font-display text-4xl font-semibold text-primary">Purrlist</h1>
          <p className="mt-1 text-sm text-muted">Tu reproductor musical kawaii, nya~</p>
        </header>
        <div className="rounded-3xl bg-surface p-6 shadow-[0_0_40px_-12px_var(--primary)] sm:p-8">
          {children}
        </div>
      </div>
      <ForgetSessionChoices />
    </main>
  );
}
