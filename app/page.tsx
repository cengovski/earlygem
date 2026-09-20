"use client";

import Link from "next/link";
import { GemCard } from "@/components/GemCard";
import { Kpis } from "@/components/Kpis";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SourceBanner } from "@/components/SourceBanner";
import { TapeTable } from "@/components/TapeTable";
import { TraderCard } from "@/components/TraderCard";
import { pickSmartRoster } from "@/lib/smart";

export default function HomePage() {
  return (
    <Shell
      title="Smart cüzdan radar"
      subtitle="Öne çıkanlar Dex araması değil: FOMO'da bol takipçili ve tape'de işe yarayan cüzdanların son alış kümesi. Skor = KOL + smart + taze havuz + düşük cap."
    >
      <PulseGate>
        {(bundle) => {
          const roster = pickSmartRoster(bundle.traders, 8);
          const dex = bundle.dexWatch.slice(0, 4);
          return (
            <>
              <SourceBanner meta={bundle.meta} />
              <Kpis
                status={bundle.status}
                extra={[
                  { label: "smart/KOL", value: String(roster.length) },
                  { label: "radar", value: String(bundle.featured.length) },
                ]}
              />
              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="text-lg font-medium">İzlenen smart cüzdanlar</h2>
                  <Link href="/traders" className="text-sm text-mute hover:text-accent">
                    tüm roster →
                  </Link>
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
                  <div className="flex items-center gap-3">
                    <RefreshButton />
                    <Link href="/gems" className="text-sm text-mute hover:text-accent">
                      tüm gemler →
                    </Link>
                  </div>
                </div>
                {bundle.featured.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {bundle.featured.map((g) => (
                      <GemCard key={g.id} gem={g} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-line bg-surface p-6 text-sm text-mute">
                    Şu an smart küme alış yok. Tape yenilenince roster tekrar taranır.
                  </p>
                )}
              </section>
              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="text-lg font-medium">Smart tape</h2>
                  <Link href="/tape" className="text-sm text-mute hover:text-accent">
                    tam şerit →
                  </Link>
                </div>
                <TapeTable rows={bundle.smartTape.slice(0, 16)} />
              </section>
              {dex.length ? (
                <section>
                  <div className="mb-3 flex items-end justify-between">
                    <h2 className="text-lg font-medium">SOL/BASE izleme</h2>
                    <span className="text-xs text-mute">FOMO cüzdan kanıtı yok — radar skoruna karışmaz</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {dex.map((g) => (
                      <GemCard key={g.id} gem={g} />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          );
        }}
      </PulseGate>
    </Shell>
  );
}
