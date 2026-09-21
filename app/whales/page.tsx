"use client";

import Link from "next/link";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SmartBadge } from "@/components/Badge";
import { compact, shortAddr, usd } from "@/lib/format";

function srcs(reasons: string[]) {
  return reasons.filter((r) => r.startsWith("src:")).map((r) => r.slice(4));
}

export default function WhalesPage() {
  return (
    <Shell
      title="KOL / smart / whale roster"
      subtitle="GMGN KOL + Smart Money akışı, Axiom etiketli cüzdanlar ve Pump.fun uygulama profilleri. Sadece buy/sell indexlenir."
    >
      <PulseGate>
        {(bundle) => {
          const rows = bundle.traders.filter((t) => t.kind === "kol" || t.kind === "smart" || srcs(t.smartReasons).length);
          const tape = bundle.tape.filter((r) => r.flags.some((f) => ["kol", "smart", "axiom", "pumpfun", "gmgn"].includes(f)));
          return (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <RefreshButton />
                <span className="text-mute">{rows.length} cüzdan · {tape.length} harici fill</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="min-w-[960px] w-full text-left text-sm">
                  <thead className="bg-[#18160f] text-[11px] uppercase tracking-wider text-mute">
                    <tr>
                      <th className="px-3 py-2">handle</th>
                      <th className="px-3 py-2">sınıf</th>
                      <th className="px-3 py-2">kaynak</th>
                      <th className="px-3 py-2">SOL</th>
                      <th className="px-3 py-2">EVM</th>
                      <th className="px-3 py-2">fill</th>
                      <th className="px-3 py-2">hacim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 120).map((t) => (
                      <tr key={`${t.handle}-${t.solana || t.address}`} className="border-t border-line">
                        <td className="px-3 py-2">
                          <Link href={`/find?q=${encodeURIComponent(t.handle)}`} className="hover:text-accent">
                            @{t.handle}
                          </Link>
                          {t.followers ? <div className="text-[11px] text-mute">{compact(t.followers)} flw</div> : null}
                        </td>
                        <td className="px-3 py-2">
                          <SmartBadge kind={t.kind} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {srcs(t.smartReasons).map((s) => (
                              <span key={s} className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-mute">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-mute">{t.solana ? shortAddr(t.solana) : "—"}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-mute">{t.address ? shortAddr(t.address) : "—"}</td>
                        <td className="num px-3 py-2">{t.fills}</td>
                        <td className="num px-3 py-2">{usd(t.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </PulseGate>
    </Shell>
  );
}
