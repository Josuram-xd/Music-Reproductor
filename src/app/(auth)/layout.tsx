import { ForgetSessionChoices } from "@/components/auth/forget-session-choices";
import { PixelCat, PixelNote, PixelSparkle } from "@/components/ui/pixel/pixel";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <div aria-hidden className="relative mx-auto mb-3 w-20">
            <PixelCat className="w-20 motion-safe:animate-bob" />
            <PixelSparkle className="absolute -top-2 -left-5 w-3" />
            <PixelSparkle className="absolute top-3 -right-6 w-2" delay={500} />
            <PixelNote className="absolute -right-3 -bottom-1 w-3" />
          </div>
          <h1 className="font-display text-4xl font-semibold text-primary">Purrlist</h1>
          <p className="mt-1 text-sm text-muted">Tu reproductor musical kawaii, nya~</p>
        </header>
        <div className="rounded-3xl border-2 border-surface-2 bg-surface p-6 shadow-pixel sm:p-8">
          {children}
        </div>
      </div>
      <ForgetSessionChoices />
    </main>
  );
}
