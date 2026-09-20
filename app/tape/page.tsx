import { Kpis } from "@/components/Kpis";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SourceBanner } from "@/components/SourceBanner";
import { TapeTable } from "@/components/TapeTable";
import { fetchRadarBundle } from "@/lib/radar";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function TapePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const bundle = await fetchRadarBundle();
  const rows = view === "all" ? bundle.tape : bundle.smartTape.length ? bundle.smartTape : bundle.tape;

  return (
    <Shell
      title="Canlı tape"
      subtitle="Varsayılan: KOL ve smart cüzdan fill'leri. FIRST = izlenen evrende yeni pozisyon."
    >
      <SourceBanner meta={bundle.meta} />
      <Kpis status={bundle.status} extra={[{ label: "satır", value: String(rows.length) }]} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <RefreshButton />
        <a href="/tape" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">
          smart
        </a>
        <a href="/tape?view=all" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">
          tüm evren
        </a>
      </div>
      <TapeTable rows={rows} />
    </Shell>
  );
}
