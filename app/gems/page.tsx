"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GemCard } from "@/components/GemCard";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SourceBanner } from "@/components/SourceBanner";

function GemsInner() {
  const params = useSearchParams();
  const chain = params.get("chain");
  const view = params.get("view");
  return (
    <Shell
      title="Gem radar"
      subtitle="Varsayılan: en az bir KOL veya smart cüzdan almış RH tokenlar. Dex izleme ayrı — FOMO handle yoksa öne çıkmaz."
    >
      <PulseGate>
        {(bundle) => {
          const { gems, dexWatch } = bundle;
          const watched = gems.filter((g) => g.kolCount + g.smartCount > 0);
          const base = view === "all" ? [...gems, ...dexWatch] : view === "dex" ? dexWatch : watched.length ? watched : gems;
          const rows = chain ? base.filter((g) => g.chain === chain) : base;
          return (
            <>
              <SourceBanner meta={bundle.meta} />
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <RefreshButton />
                {[
                  ["smart küme", "/gems"],
                  ["tüm RH", "/gems?view=all&chain=robinhood"],
                  ["sol/base izleme", "/gems?view=dex"],
                ].map(([label, href]) => (
                  <a key={href} href={href} className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">
                    {label}
                  </a>
                ))}
              </div>
              {rows.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((g) => (
                    <GemCard key={g.id} gem={g} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-line bg-surface p-6 text-sm text-mute">
                  Bu görünüm boş. Üstten yenile veya Log sayfasından kaynak durumuna bak.
                </p>
              )}
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
