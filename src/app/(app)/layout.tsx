import { Suspense } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { SidebarPlaylists } from "@/components/playlists/sidebar-playlists";
import { SessionKeeper } from "@/components/session/session-keeper";
import { AppShell } from "@/components/shell/app-shell";
import { getPlaylistNames } from "@/lib/playlists/queries";
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
        playlists={
          <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-surface-2/40" />}>
            <Playlists />
          </Suspense>
        }
      >
        {children}
      </AppShell>
      <SessionKeeper graceSeconds={parseGraceSeconds(process.env.SESSION_GRACE_SECONDS)} />
    </>
  );
}

async function Playlists() {
  return <SidebarPlaylists playlists={await getPlaylistNames()} />;
}
