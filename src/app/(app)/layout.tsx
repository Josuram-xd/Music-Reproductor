import { Suspense } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { SessionKeeper } from "@/components/session/session-keeper";
import { AppShell } from "@/components/shell/app-shell";
import { parseGraceSeconds } from "@/lib/session/grace";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppShell
        userMenu={
          // Reads the session: streams in behind a boundary so the shell stays static.
          <Suspense fallback={<div className="h-11 w-28 animate-pulse rounded-2xl bg-surface" />}>
            <UserMenu />
          </Suspense>
        }
      >
        {children}
      </AppShell>
      <SessionKeeper graceSeconds={parseGraceSeconds(process.env.SESSION_GRACE_SECONDS)} />
    </>
  );
}
