import { Kpis } from "@/components/Kpis";
import { Shell } from "@/components/Shell";
import { TapeTable } from "@/components/TapeTable";
import { fetchPulseStatus, fetchRadarBundle } from "@/lib/sources";

export const revalidate = 15;

export default async function TapePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const [status, bundle] = await Promise.all([fetchPulseStatus(), fetchRadarBundle()]);
  const rows = view === "all" ? bundle.tape : bundle.smartTape.length ? bundle.smartTape : bundle.tape;
  return (
    <Shell title="Canlı tape" subtitle="Varsayılan: KOL ve smart cüzdan fill'leri. FIRST = izlenen evrende yeni pozisyon.">
      <Kpis status={status} extra={[{ label: "satır", value: String(rows.length) }]} />
      <div className="mb-4 flex gap-2 text-sm">
        <a href="/tape" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">smart</a>
        <a href="/tape?view=all" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">tüm evren</a>
      </div>
      <TapeTable rows={rows} />
    </Shell>
  );
}
