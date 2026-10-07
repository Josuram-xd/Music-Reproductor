import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryView } from "@/components/library/library-view";
import { PageHeader } from "@/components/ui/page-header";
import { getLibrary } from "@/lib/library/queries";

export const metadata: Metadata = { title: "Biblioteca · Purrlist" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Biblioteca">Tus canciones, vídeos y carpetas</PageHeader>
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
  const { tracks, folders } = await getLibrary();
  return <LibraryView tracks={tracks} folders={folders} />;
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
