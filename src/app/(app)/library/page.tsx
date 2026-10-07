import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Biblioteca · Purrlist" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Biblioteca">Tus canciones, vídeos y carpetas</PageHeader>
      <EmptyState title="Tu biblioteca está vacía">
        Pronto podrás subir tu música y organizarla en carpetas, nya~
      </EmptyState>
    </>
  );
}
