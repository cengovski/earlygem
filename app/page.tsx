import Link from "next/link";
import { GemCard } from "@/components/GemCard";
import { Kpis } from "@/components/Kpis";
import { Shell } from "@/components/Shell";
import { TapeTable } from "@/components/TapeTable";
import { fetchAllGems, fetchMixedTape, fetchPulseStatus } from "@/lib/sources";

export const revalidate = 20;

export default async function HomePage() {
  const [status, tape, gems] = await Promise.all([fetchPulseStatus(), fetchMixedTape(), fetchAllGems()]);
  return (
    <Shell title="Erken gem radar" subtitle="FOMO cuzdanlari Robinhood Chain'de ~1s geriden, Solana DexScreener taze ciftlerden. Skor: taze havuz + dusuk cap + alici kumesi.">
      <Kpis status={status} extra={[{ label: "aday gem", value: String(gems.length) }]} />
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-medium">Su an one cikanlar</h2>
          <Link href="/gems" className="text-sm text-mute hover:text-accent">tum gemler →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gems.slice(0, 6).map((g) => <GemCard key={g.id} gem={g} />)}</div>
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-medium">Canli tape</h2>
          <Link href="/tape" className="text-sm text-mute hover:text-accent">tam serit →</Link>
        </div>
        <TapeTable rows={tape.slice(0, 18)} />
      </section>
    </Shell>
  );
}
