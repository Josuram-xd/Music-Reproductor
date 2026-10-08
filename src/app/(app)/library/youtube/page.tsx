import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { YouTubeSearchView } from "@/components/youtube/youtube-search-view";
import { getFolders } from "@/lib/library/queries";

export const metadata: Metadata = { title: "YouTube · Purrlist" };

export default function YouTubePage() {
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
      <PageHeader title="Buscar en YouTube">
        Reprodúcelo, añádelo a la cola o guárdalo en tus carpetas
      </PageHeader>
      <div className="px-4 pb-8 @tablet:px-8">
        {/* Reads the user's folders: streams in (Cache Components). */}
        <Suspense fallback={<div className="h-11 animate-pulse rounded-2xl bg-surface" />}>
          <Search />
        </Suspense>
      </div>
    </>
  );
}

async function Search() {
  return <YouTubeSearchView folders={await getFolders()} />;
}
