import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaylistsView } from "@/components/playlists/playlists-view";
import { PageHeader } from "@/components/ui/page-header";
import { getPlaylistSummaries } from "@/lib/playlists/queries";

export const metadata: Metadata = { title: "Playlists · Purrlist" };

export default function PlaylistsPage() {
  return (
    <>
      <PageHeader title="Playlists">Todas las listas que quieras, nya~</PageHeader>
      <div className="px-4 pb-8 @tablet:px-8">
        {/* Reads the user's playlists: streams in (Cache Components). */}
        <Suspense fallback={<PlaylistsSkeleton />}>
          <Playlists />
        </Suspense>
      </div>
    </>
  );
}

async function Playlists() {
  return <PlaylistsView playlists={await getPlaylistSummaries()} />;
}

function PlaylistsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-11 w-40 animate-pulse rounded-2xl bg-surface" />
      <div className="grid grid-cols-2 gap-4 @tablet:grid-cols-3 @desktop:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-3xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
