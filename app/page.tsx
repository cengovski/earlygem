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
    <Shell title="Ağ ağ radar" subtitle="RH = FOMO handle tape. SOL = çözülen FOMO Solana cüzdanlarının swap’i. Diğer ağlar Dex izleme.">
      <PulseGate>
        {(bundle) => {
          const roster = pickSmartRoster(bundle.traders, 8);
          const rh = bundle.featured.filter((g) => g.chain === "robinhood");
          const solTracked = bundle.solGems || [];
          return (
            <>
              <SourceBanner meta={bundle.meta} />
              <Kpis status={bundle.status} extra={[{ label: "smart/KOL", value: String(roster.length) }, { label: "SOL cüzdan", value: String(bundle.traders.filter((t) => t.solana).length) }]} />
              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-medium">RH · izlenen smart cüzdanlar</h2>
                    <p className="mt-0.5 text-xs text-mute">SOL adresi varsa kartta ve traders sütununda durur.</p>
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
                const gems =
                  lane.id === "robinhood"
                    ? rh.slice(0, 6)
                    : lane.id === "solana"
                      ? (solTracked.length ? solTracked.slice(0, 6) : bundle.dexWatch.filter((g) => g.chain === "solana").slice(0, 6))
                      : bundle.dexWatch.filter((g) => g.chain === lane.id).slice(0, 6);
                return <ChainLaneSection key={lane.id} lane={lane} gems={gems} extra={lane.source === "pulse" ? <RefreshButton /> : null} />;
              })}
              <section className="mb-8">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-medium">RH + SOL · smart tape</h2>
                    <p className="mt-0.5 text-xs text-mute">RH pulse fill + çözülen SOL cüzdan swap’i.</p>
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
