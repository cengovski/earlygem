"use client";

import Link from "next/link";
import { ChainLaneSection } from "@/components/ChainLane";
import { Kpis } from "@/components/Kpis";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SourceBanner } from "@/components/SourceBanner";
import { TapeTable } from "@/components/TapeTable";
import { TraderCard } from "@/components/TraderCard";
import { CHAIN_LANES } from "@/lib/chains";
import { pickSmartRoster } from "@/lib/smart";

export default function HomePage() {
  return (
    <Shell
      title="Ağ ağ radar"
      subtitle="FOMO app 6 ağ destekler. Handle’lı smart küme yalnız Robinhood tape’de var. Diğer ağlar ayrı şerit: Dex izleme, FOMO cüzdanı yok."
    >
      <PulseGate>
        {(bundle) => {
          const roster = pickSmartRoster(bundle.traders, 8);
          const rh = bundle.featured.filter((g) => g.chain === "robinhood");
          return (
            <>
              <SourceBanner meta={bundle.meta} />
              <Kpis
                status={bundle.status}
                extra={[
                  { label: "smart/KOL", value: String(roster.length) },
                  { label: "RH radar", value: String(rh.length) },
                ]}
              />
              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-medium">RH · izlenen smart cüzdanlar</h2>
                    <p className="mt-0.5 text-xs text-mute">fomopulse traders — diğer ağlarda handle listesi yok.</p>
                  </div>
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
              {CHAIN_LANES.map((lane) => {
                const gems =
                  lane.source === "pulse"
                    ? rh.slice(0, 6)
                    : bundle.dexWatch.filter((g) => g.chain === lane.id).slice(0, 6);
                return (
                  <ChainLaneSection
                    key={lane.id}
                    lane={lane}
                    gems={gems}
                    extra={lane.source === "pulse" ? <RefreshButton /> : null}
                  />
                );
              })}
              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-medium">RH · smart tape</h2>
                    <p className="mt-0.5 text-xs text-mute">Yalnız buy/sell fill. Transfer yok.</p>
                  </div>
                  <Link href="/tape" className="text-sm text-mute hover:text-accent">
                    tam şerit →
                  </Link>
                </div>
                <TapeTable rows={bundle.smartTape.slice(0, 16)} />
              </section>
            </>
          );
        }}
      </PulseGate>
    </Shell>
  );
}
