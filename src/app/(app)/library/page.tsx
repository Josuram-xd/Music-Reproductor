import type { Metadata } from "next";
import { MonitorPlay, Music2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LibraryView } from "@/components/library/library-view";
import { PageHeader } from "@/components/ui/page-header";
import { getLibrary } from "@/lib/library/queries";
import { getPlaylistNames } from "@/lib/playlists/queries";

export const metadata: Metadata = { title: "Biblioteca · Purrlist" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Biblioteca">Tus canciones, vídeos y carpetas</PageHeader>
      <div className="flex flex-wrap gap-2 px-4 pb-4 @tablet:px-8">
        <Link
          href="/library/youtube"
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-surface-2 px-4 font-display font-semibold text-secondary transition hover:bg-secondary/15 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
        >
          <MonitorPlay aria-hidden className="size-4" />
          Buscar en YouTube
        </Link>
        <Link
          href="/library/spotify"
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-surface-2 px-4 font-display font-semibold text-accent transition hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
        >
          <Music2 aria-hidden className="size-4" />
          Buscar en Spotify
        </Link>
      </div>
      <div className="px-4 pb-8 @tablet:px-8">
        {/* Reads the user's library and the URL: streams in (Cache Components). */}
        <Suspense fallback={<LibrarySkeleton />}>
          <Library />
        </Suspense>
      </div>
    </>
  );
}

async function Library() {
  const [{ tracks, folders }, playlists] = await Promise.all([getLibrary(), getPlaylistNames()]);
  return <LibraryView tracks={tracks} folders={folders} playlists={playlists} />;
}

function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-32 animate-pulse rounded-3xl bg-surface" />
      <div className="h-11 animate-pulse rounded-2xl bg-surface" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
