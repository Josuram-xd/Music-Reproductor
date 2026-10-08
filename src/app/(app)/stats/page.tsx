import type { Metadata } from "next";
import { StatsDetails } from "@/components/stats/stats-details";
import { StatsKpis } from "@/components/stats/stats-kpis";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mis stats · Purrlist" };

/** "Mis stats": the sections load in the browser (they need its time zone). */
export default function StatsPage() {
  return (
    <>
      <PageHeader title="Mis stats">Lo que más escuchas y cuándo</PageHeader>
      <div className="flex flex-col gap-8 px-4 pb-8 @tablet:px-8">
        <StatsKpis />
        <StatsDetails />
      </div>
    </>
  );
}
