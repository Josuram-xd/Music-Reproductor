import type { ReactNode } from "react";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerHost } from "@/components/player/player-host";
import { DropChoiceDialog } from "@/components/queue/drop-choice-dialog";
import { Toaster } from "@/components/ui/toaster";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";
import { QueueButton, QueueDrawerProvider } from "./queue-drawer";
import { QueuePanel } from "./queue-panel";

interface AppShellProps {
  children: ReactNode;
  /** Account area in the header (streams in, it reads the session). */
  userMenu: ReactNode;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-display text-2xl font-semibold text-primary">
      <span aria-hidden>🐱</span>
      <span className={compact ? "sr-only @desktop:not-sr-only" : ""}>Purrlist</span>
    </span>
  );
}

/**
 * Responsive app layout driven by container queries (docs/DESIGN.md):
 * - < 640px: one column, bottom tab bar, queue as a bottom sheet.
 * - 640–1024px: icon-only sidebar, queue as a slide-in side panel.
 * - ≥ 1024px: sidebar with labels · content · fixed queue column.
 */
export function AppShell({ children, userMenu }: AppShellProps) {
  return (
    // The container wraps the drawer too, so the <dialog> can use @tablet: variants.
    <div className="@container/app flex h-dvh flex-col">
      <QueueDrawerProvider panel={<QueuePanel />}>
        <div className="flex min-h-0 flex-1 flex-col @tablet:flex-row">
          <aside className="hidden w-18 shrink-0 flex-col gap-6 border-r border-surface-2 bg-surface px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-4 @tablet:flex @desktop:w-60">
            <div className="flex h-11 items-center justify-center @desktop:justify-start @desktop:px-2">
              <Logo compact />
            </div>
            <nav aria-label="Principal" className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} href={item.href} variant="sidebar" />
              ))}
            </nav>
            <section aria-label="Carpetas" className="hidden flex-col gap-2 px-2 @desktop:flex">
              <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Carpetas</h2>
              <p className="text-sm text-muted/80">Tus carpetas aparecerán aquí 🐾</p>
            </section>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="box-content flex h-14 shrink-0 items-center justify-between gap-2 border-b border-surface-2 px-4 pt-[env(safe-area-inset-top)]">
              <div className="@tablet:hidden">
                <Logo />
              </div>
              <div className="ml-auto flex items-center gap-1">
                <div className="hidden @tablet:block @desktop:hidden">
                  <QueueButton variant="header" />
                </div>
                {userMenu}
              </div>
            </header>

            <main id="content" className="min-h-0 flex-1 overflow-y-auto">
              {children}
            </main>

            <PlayerBar />

            <nav
              aria-label="Principal"
              className="flex shrink-0 border-t border-surface-2 bg-surface pb-[env(safe-area-inset-bottom)] @tablet:hidden"
            >
              <NavLink href="/library" variant="tab" />
              <NavLink href="/playlists" variant="tab" />
              <QueueButton variant="tab" />
              <NavLink href="/stats" variant="tab" />
              <NavLink href="/settings" variant="tab" />
            </nav>
          </div>

          <aside
            aria-label="Cola"
            className="hidden w-80 shrink-0 overflow-y-auto border-l border-surface-2 bg-surface @desktop:block"
          >
            <QueuePanel />
          </aside>
        </div>
        <Toaster />
        <DropChoiceDialog />
        <PlayerHost />
      </QueueDrawerProvider>
    </div>
  );
}
