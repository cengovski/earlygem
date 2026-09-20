"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SmartBadge } from "@/components/Badge";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { SourceBanner } from "@/components/SourceBanner";
import { compact, explorerWallet, shortAddr, usd } from "@/lib/format";

function TradersInner() {
  const kind = useSearchParams().get("kind");
  return (
    <Shell
      title="Smart / KOL roster"
      subtitle="EVM tape = Robinhood fill cüzdanı. SOL tape = Find veya mapping ile çözülen Solana adresi; swap izleme oradan."
    >
      <PulseGate>
        {(bundle) => {
          const traders = bundle.traders;
          const rows =
            kind === "kol"
              ? traders.filter((t) => t.kind === "kol")
              : kind === "sol"
                ? traders.filter((t) => t.solana)
                : kind === "smart"
                  ? traders.filter((t) => t.kind === "kol" || t.kind === "smart")
                  : traders;
          const solCount = traders.filter((t) => t.solana).length;
          return (
            <>
              <SourceBanner meta={bundle.meta} />
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <RefreshButton />
                <Link href="/traders" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">hepsi</Link>
                <Link href="/traders?kind=smart" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">smart + KOL</Link>
                <Link href="/traders?kind=kol" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">sadece KOL</Link>
                <Link href="/traders?kind=sol" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">SOL adresi var ({solCount})</Link>
              </div>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="min-w-[1100px] w-full text-left text-sm">
                  <thead className="bg-[#18160f] text-[11px] uppercase tracking-wider text-mute">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">handle</th>
                      <th className="px-3 py-2">sınıf</th>
                      <th className="px-3 py-2">EVM tape</th>
                      <th className="px-3 py-2">SOL tape</th>
                      <th className="px-3 py-2">smart</th>
                      <th className="px-3 py-2">realized</th>
                      <th className="px-3 py-2">open</th>
                      <th className="px-3 py-2">fills</th>
                      <th className="px-3 py-2">win</th>
                      <th className="px-3 py-2">flw</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!rows.length ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-8 text-sm text-mute">Roster boş. SOL sütunu Find’de çözülen veya mapping’teki adreslerden dolar.</td>
                      </tr>
                    ) : null}
                    {rows.map((t, i) => (
                      <tr key={t.handle} className="tape-row border-t border-line">
                        <td className="num px-3 py-2 text-mute">{t.rank ?? i + 1}</td>
                        <td className="px-3 py-2">
                          <Link href={`/find?q=${encodeURIComponent(t.handle)}`} className="font-medium hover:text-accent">@{t.handle}</Link>
                          {t.clan ? <div className="text-[11px] text-mute">{t.clan}</div> : null}
                        </td>
                        <td className="px-3 py-2"><SmartBadge kind={t.kind} /></td>
                        <td className="px-3 py-2 font-mono text-xs text-mute">{t.address ? <a href={explorerWallet("robinhood", t.address)} target="_blank" rel="noreferrer" className="hover:text-accent">{shortAddr(t.address, 4)}</a> : "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-mute">{t.solana ? <a href={explorerWallet("solana", t.solana)} target="_blank" rel="noreferrer" className="hover:text-accent">{shortAddr(t.solana, 4)}</a> : "—"}</td>
                        <td className="num px-3 py-2">{t.smartScore}</td>
                        <td className="num px-3 py-2">{usd(t.realized)}</td>
                        <td className="num px-3 py-2 text-mute">{usd(t.unrealized)}</td>
                        <td className="num px-3 py-2">{compact(t.fills)}</td>
                        <td className="num px-3 py-2 text-mute">{t.trips ? `${t.wins}/${t.trips}` : "—"}</td>
                        <td className="num px-3 py-2 text-mute">{compact(t.followers)}</td>
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

export default function TradersPage() {
  return (
    <Suspense>
      <TradersInner />
    </Suspense>
  );
}
