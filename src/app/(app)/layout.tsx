import { Suspense } from "react";
import { UserMenu } from "@/components/auth/user-menu";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-surface-2 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="font-display text-2xl font-semibold text-primary">Purrlist</span>
        {/* Reads the session: streams in behind a boundary so the shell stays static. */}
        <Suspense fallback={<div className="h-11 w-32 animate-pulse rounded-2xl bg-surface" />}>
          <UserMenu />
        </Suspense>
      </header>
      {children}
    </div>
  );
}
