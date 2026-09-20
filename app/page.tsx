import Link from "next/link";
import { GemCard } from "@/components/GemCard";
import { Kpis } from "@/components/Kpis";
import { Shell } from "@/components/Shell";
import { TapeTable } from "@/components/TapeTable";
import { TraderCard } from "@/components/TraderCard";
import { pickSmartRoster } from "@/lib/smart";
import { fetchPulseStatus, fetchRadarBundle } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [status, bundle] = await Promise.all([fetchPulseStatus(), fetchRadarBundle()]);
  const roster = pickSmartRoster(bundle.traders, 8);
  const dex = bundle.dexWatch.slice(0, 6);
  return (
    <Shell title="Smart cüzdan radar" subtitle="Öne çıkanlar FOMO KOL/smart kümesi. SOL/BASE ayrı izleme — DexScreener profile + pumpfun, SOL ticker araması yok.">
      <Kpis status={status} extra={[{ label: "smart/KOL", value: String(roster.length) }, { label: "radar", value: String(bundle.featured.length) }]} />
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-medium">İzlenen smart cüzdanlar</h2>
          <Link href="/traders" className="text-sm text-mute hover:text-accent">tüm roster →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roster.map((t) => (
            <TraderCard key={t.handle} trader={t} />
          ))}
        </div>
      </section>
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-medium">Radar — smart küme</h2>
          <Link href="/gems" className="text-sm text-mute hover:text-accent">tüm gemler →</Link>
        </div>
        {bundle.featured.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bundle.featured.map((g) => (
              <GemCard key={g.id} gem={g} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-surface p-6 text-sm text-mute">Smart küme yok. Yenile.</p>
        )}
      </section>
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-medium">Smart tape</h2>
          <Link href="/tape" className="text-sm text-mute hover:text-accent">tam şerit →</Link>
        </div>
        <TapeTable rows={bundle.smartTape.slice(0, 16)} />
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-medium">SOL/BASE izleme</h2>
          <Link href="/gems?view=dex" className="text-xs text-mute hover:text-accent">tümü →</Link>
        </div>
        {dex.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dex.map((g) => (
              <GemCard key={g.id} gem={g} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-surface p-6 text-sm text-mute">Dex izleme boş. Log'a bak.</p>
        )}
      </section>
    </Shell>
  );
}
