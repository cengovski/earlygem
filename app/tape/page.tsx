"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Kpis } from "@/components/Kpis";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SourceBanner } from "@/components/SourceBanner";
import { TapeTable } from "@/components/TapeTable";

function TapeInner() {
  const view = useSearchParams().get("view");
  return (
    <Shell title="Canlı tape" subtitle="RH = fomopulse buy/sell. SOL = çözülen FOMO Solana cüzdanlarının RPC swap’i.">
      <PulseGate>
        {(bundle) => {
          const sol = bundle.solTape || [];
          const rows = view === "sol" ? sol : view === "all" ? bundle.tape : bundle.smartTape.length ? bundle.smartTape : bundle.tape;
          return (
            <>
              <SourceBanner meta={bundle.meta} />
              <Kpis status={bundle.status} extra={[{ label: "satır", value: String(rows.length) }, { label: "SOL fill", value: String(sol.length) }]} />
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <RefreshButton />
                <a href="/tape" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">smart</a>
                <a href="/tape?view=sol" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">SOL tape</a>
                <a href="/tape?view=all" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">tüm evren</a>
              </div>
              <TapeTable rows={rows} />
            </>
          );
        }}
      </PulseGate>
    </Shell>
  );
}

export default function TapePage() {
  return (
    <Suspense>
      <TapeInner />
    </Suspense>
  );
}
