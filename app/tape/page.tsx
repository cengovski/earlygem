"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlertRadar } from "@/components/AlertRadar";
import { GmgnConnect } from "@/components/GmgnConnect";
import { Kpis } from "@/components/Kpis";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SourceBanner } from "@/components/SourceBanner";
import { TapeTable } from "@/components/TapeTable";

function TapeInner() {
  const view = useSearchParams().get("view") || "all";
  return (
    <Shell title="Canlı tape" subtitle="20 dk tarayıcı havuzu. Çakışan fill’ler (tx / cüzdan+token+usd) elenir, eşik dolunca alarm çıkar.">
      <PulseGate>
        {(bundle) => {
          const sol = bundle.solTape || [];
          const rows = view === "sol" ? sol : view === "smart" ? bundle.smartTape : bundle.tape;
          return (
            <>
              <GmgnConnect />
              <SourceBanner meta={bundle.meta} />
              <Kpis status={bundle.status} extra={[{ label: "satır", value: String(rows.length) }, { label: "SOL fill", value: String(sol.length) }]} />
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <RefreshButton />
                <a href="/tape?view=smart" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">smart</a>
                <a href="/tape?view=sol" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">SOL tape</a>
                <a href="/tape?view=all" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">tüm evren</a>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="min-w-0 flex-1">
                  <TapeTable rows={rows} />
                </div>
                <AlertRadar tape={bundle.tape} />
              </div>
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
