import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mis stats · Purrlist" };

export default function StatsPage() {
  return (
    <>
      <PageHeader title="Mis stats">Lo que más escuchas y cuándo</PageHeader>
      <EmptyState title="Todavía no hay estadísticas">
        Escucha algo de música y aquí verás tus favoritas, nya~
      </EmptyState>
    </>
  );
}
