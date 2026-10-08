import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { PlaylistView } from "@/components/playlists/playlist-view";
import { getPlaylist } from "@/lib/playlists/queries";

export const metadata: Metadata = { title: "Playlist · Purrlist" };

export default function PlaylistPage({ params }: PageProps<"/playlists/[id]">) {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8 @tablet:px-8">
      <Link
        href="/playlists"
        className="inline-flex w-fit items-center gap-1 rounded-xl px-2 py-1 text-sm text-muted transition hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Playlists
      </Link>
      {/* Params and the user's data are request-time: stream in (Cache Components). */}
      <Suspense fallback={<PlaylistSkeleton />}>
        <Playlist params={params} />
      </Suspense>
    </div>
  );
}

async function Playlist({ params }: { params: PageProps<"/playlists/[id]">["params"] }) {
  const { id } = await params;
  const playlist = await getPlaylist(id);
  if (!playlist) notFound();
  return <PlaylistView playlist={playlist} />;
}

function PlaylistSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-end gap-4">
        <div className="size-40 animate-pulse rounded-2xl bg-surface @tablet:size-48" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="h-9 w-2/3 animate-pulse rounded-2xl bg-surface" />
          <div className="h-11 w-1/2 animate-pulse rounded-2xl bg-surface" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  );
}
