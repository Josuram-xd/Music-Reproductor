import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { DropPreferenceSetting } from "@/components/queue/drop-preference-setting";

export const metadata: Metadata = { title: "Ajustes · Purrlist" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes">
        Pronto podrás conectar YouTube y Spotify y elegir tu reproductor 🐾
      </PageHeader>
      <div className="flex flex-col gap-6 px-4 py-4 @tablet:px-8">
        <section aria-labelledby="settings-queue" className="flex max-w-xl flex-col gap-3">
          <h2 id="settings-queue" className="font-display text-xl font-semibold">
            Cola
          </h2>
          <DropPreferenceSetting />
        </section>
      </div>
    </>
  );
}
