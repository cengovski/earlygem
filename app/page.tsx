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
    <Shell title="Ağ ağ radar" subtitle="Key’ler tarayıcıda. 20 dk havuz, çakışma elenir, tape + alarm senin IP’nden.">
      <PulseGate>
        {(bundle) => {
          const roster = pickSmartRoster(bundle.traders, 8);
          const rh = bundle.featured.filter((g) => g.chain === "robinhood");
          const watched = bundle.solGems || [];
          return (
            <>
              <SourceBanner meta={bundle.meta} />
              <Kpis status={bundle.status} extra={[{ label: "smart/KOL", value: String(roster.length) }, { label: "GMGN fill", value: String((bundle.solTape || []).length) }]} />
              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-medium">RH · izlenen smart cüzdanlar</h2>
                    <p className="mt-0.5 text-xs text-mute">Aynı EVM adres Base/BSC/ETH/MON/RH’de GMGN ile taranır. SOL ayrı adres.</p>
                  </div>
                  <Link href="/traders" className="text-sm text-mute hover:text-accent">tüm roster →</Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {roster.map((t) => (
                    <TraderCard key={t.handle} trader={t} />
                  ))}
                </div>
              </section>
              {CHAIN_LANES.map((lane) => {
                const fromWatch = watched.filter((g) => g.chain === lane.id);
                const gems =
                  lane.id === "robinhood" && rh.length
                    ? rh.slice(0, 6)
                    : fromWatch.length
                      ? fromWatch.slice(0, 6)
                      : bundle.dexWatch.filter((g) => g.chain === lane.id).slice(0, 6);
                return <ChainLaneSection key={lane.id} lane={lane} gems={gems} extra={lane.source === "pulse" ? <RefreshButton /> : null} />;
              })}
              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-medium">Smart tape</h2>
                    <p className="mt-0.5 text-xs text-mute">RH pulse + GMGN buy/sell. Transfer yok.</p>
                  </div>
                  <Link href="/tape" className="text-sm text-mute hover:text-accent">tam şerit →</Link>
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
