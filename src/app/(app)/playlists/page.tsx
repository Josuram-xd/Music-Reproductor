import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Playlists · Purrlist" };

export default function PlaylistsPage() {
  return (
    <>
      <PageHeader title="Playlists" />
      <EmptyState title="Aún no tienes playlists">
        Crea una y llénala con tus favoritas 🐾
      </EmptyState>
    </>
  );
}
