import type { Metadata } from "next";
import { Suspense } from "react";
import { DropPreferenceSetting } from "@/components/queue/drop-preference-setting";
import { FloatingPlayerSetting } from "@/components/settings/floating-player-setting";
import { RadioSetting } from "@/components/settings/radio-setting";
import { SpotifySetting } from "@/components/settings/spotify-setting";
import { YouTubeKeySetting } from "@/components/settings/youtube-key-setting";
import { PageHeader } from "@/components/ui/page-header";
import { getSpotifyIntegration, getYouTubeIntegration } from "@/lib/integrations/queries";

export const metadata: Metadata = { title: "Ajustes · Purrlist" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes">Tu cola, tus integraciones y tus preferencias</PageHeader>
      <div className="flex flex-col gap-8 px-4 py-4 @tablet:px-8">
        <section aria-labelledby="settings-player" className="flex max-w-xl flex-col gap-3">
          <h2 id="settings-player" className="font-display text-xl font-semibold">
            Reproductor
          </h2>
          <FloatingPlayerSetting />
          <RadioSetting />
        </section>

        <section aria-labelledby="settings-queue" className="flex max-w-xl flex-col gap-3">
          <h2 id="settings-queue" className="font-display text-xl font-semibold">
            Cola
          </h2>
          <DropPreferenceSetting />
        </section>

        <section aria-labelledby="settings-youtube" className="flex max-w-xl flex-col gap-3">
          <h2 id="settings-youtube" className="font-display text-xl font-semibold">
            YouTube
          </h2>
          {/* Reads the user's integration: streams in (Cache Components). */}
          <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-surface" />}>
            <YouTube />
          </Suspense>
        </section>

        <section aria-labelledby="settings-spotify" className="flex max-w-xl flex-col gap-3">
          <h2 id="settings-spotify" className="font-display text-xl font-semibold">
            Spotify
          </h2>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface" />}>
            <Spotify />
          </Suspense>
        </section>
      </div>
    </>
  );
}

async function YouTube() {
  return <YouTubeKeySetting integration={await getYouTubeIntegration()} />;
}

async function Spotify() {
  return <SpotifySetting integration={await getSpotifyIntegration()} />;
}
