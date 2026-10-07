import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Ajustes · Purrlist" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <EmptyState title="Nada que ajustar todavía">
        Aquí podrás conectar YouTube y Spotify y elegir tu reproductor 🐾
      </EmptyState>
    </>
  );
}
