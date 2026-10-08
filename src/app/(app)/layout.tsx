import { Suspense } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { SidebarPlaylists } from "@/components/playlists/sidebar-playlists";
import { RadioFiller } from "@/components/queue/radio-filler";
import { SessionKeeper } from "@/components/session/session-keeper";
import { SettingsHydrator } from "@/components/settings/settings-hydrator";
import { AppShell } from "@/components/shell/app-shell";
import { getPlaylistNames } from "@/lib/playlists/queries";
import { parseGraceSeconds } from "@/lib/session/grace";
import { getUserSettings } from "@/lib/settings/queries";

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
      {/* Reads the user's preferences: streams in (Cache Components). */}
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
      <RadioFiller />
      <SessionKeeper graceSeconds={parseGraceSeconds(process.env.SESSION_GRACE_SECONDS)} />
    </>
  );
}

async function Playlists() {
  return <SidebarPlaylists playlists={await getPlaylistNames()} />;
}

async function Settings() {
  return <SettingsHydrator values={await getUserSettings()} />;
}
