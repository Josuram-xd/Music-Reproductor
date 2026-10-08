import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { SpotifySearchView } from "@/components/spotify/spotify-search-view";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSpotifyIntegration } from "@/lib/integrations/queries";
import { isPremium } from "@/lib/spotify/messages";

export const metadata: Metadata = { title: "Spotify · Purrlist" };

export default function SpotifyPage() {
  return (
    <>
      <div className="px-4 pt-6 @tablet:px-8">
        <Link
          href="/library"
          className="inline-flex w-fit items-center gap-1 rounded-xl px-2 py-1 text-sm text-muted transition hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Biblioteca
        </Link>
      </div>
      <PageHeader title="Buscar en Spotify">Reprodúcelo o añádelo a la cola</PageHeader>
      <div className="px-4 pb-8 @tablet:px-8">
        {/* Reads the user's integration: streams in (Cache Components). */}
        <Suspense fallback={<div className="h-11 animate-pulse rounded-2xl bg-surface" />}>
          <SpotifySearch />
        </Suspense>
      </div>
    </>
  );
}

async function SpotifySearch() {
  const integration = await getSpotifyIntegration();
  if (!integration.connected) {
    return (
      <EmptyState title="Spotify no está conectado">
        <span className="flex flex-col items-center gap-3">
          Conecta tu cuenta en Ajustes (te guiamos paso a paso) y vuelve aquí
          <Link
            href="/settings"
            className="inline-flex h-11 items-center rounded-2xl bg-accent px-5 font-display font-semibold text-bg transition hover:brightness-110"
          >
            Ir a Ajustes
          </Link>
        </span>
      </EmptyState>
    );
  }
  // Unknown account type: let them try (Spotify itself will say no if needed).
  return <SpotifySearchView premium={!integration.product || isPremium(integration.product)} />;
}
