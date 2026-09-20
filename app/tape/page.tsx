import { Kpis } from "@/components/Kpis";
import { Shell } from "@/components/Shell";
import { TapeTable } from "@/components/TapeTable";
import { fetchMixedTape, fetchPulseStatus } from "@/lib/sources";

export const revalidate = 15;

export default async function TapePage() {
  const [status, tape] = await Promise.all([fetchPulseStatus(), fetchMixedTape()]);
  return (
    <Shell title="Canli tape" subtitle="RH: fomopulse acik API. SOL: DexScreener akisi. FIRST = izlenen evrende yeni giris.">
      <Kpis status={status} extra={[{ label: "satir", value: String(tape.length) }]} />
      <TapeTable rows={tape} />
    </Shell>
  );
}
