"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChainLaneSection } from "@/components/ChainLane";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SourceBanner } from "@/components/SourceBanner";
import { CHAIN_LANES } from "@/lib/chains";
import type { ChainId } from "@/lib/types";

function GemsInner() {
  const params = useSearchParams();
  const chain = params.get("chain") as ChainId | null;
  return (
    <Shell title="Gem radar — ağ ağ" subtitle="RH tape alış. SOL = FOMO SOL cüzdan swap’i, yoksa Dex. Diğerleri Dex.">
      <PulseGate>
        {(bundle) => {
          const lanes = chain ? CHAIN_LANES.filter((l) => l.id === chain) : CHAIN_LANES;
          return (
            <>
              <SourceBanner meta={bundle.meta} />
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <RefreshButton />
                <a href="/gems" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">tüm ağlar</a>
                {CHAIN_LANES.map((l) => (
                  <a key={l.id} href={`/gems?chain=${l.id}`} className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">{l.short}</a>
                ))}
              </div>
              {lanes.map((lane) => {
                const gems =
                  lane.id === "robinhood"
                    ? bundle.gems.filter((g) => g.chain === "robinhood")
                    : lane.id === "solana"
                      ? [...(bundle.solGems || []), ...bundle.dexWatch.filter((g) => g.chain === "solana")]
                      : bundle.dexWatch.filter((g) => g.chain === lane.id);
                return <ChainLaneSection key={lane.id} lane={lane} gems={gems} />;
              })}
            </>
          );
        }}
      </PulseGate>
    </Shell>
  );
}

export default function GemsPage() {
  return (
    <Suspense>
      <GemsInner />
    </Suspense>
  );
}
