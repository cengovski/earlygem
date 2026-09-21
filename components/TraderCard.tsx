import Link from "next/link";
import { compact, explorerWallet, shortAddr, usd } from "@/lib/format";
import type { Trader } from "@/lib/types";
import { SmartBadge } from "./Badge";

export function TraderCard({ trader }: { trader: Trader }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/find?q=${encodeURIComponent(trader.handle)}`} className="font-medium hover:text-accent">@{trader.handle}</Link>
        <SmartBadge kind={trader.kind} />
      </div>
      <div className="mt-1 text-[11px] text-mute">{trader.displayName}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-mute">
        <div>takip <span className="num text-ink">{compact(trader.followers)}</span></div>
        <div>rank <span className="num text-ink">{trader.rank ?? "—"}</span></div>
        <div>tape <span className="num text-ink">{usd(trader.volume)}</span></div>
        <div>smart <span className="num text-ink">{trader.smartScore}</span></div>
      </dl>
      <div className="mt-2 font-mono text-[10px] text-mute">EVM {trader.address ? <a href={explorerWallet("robinhood", trader.address)}>{shortAddr(trader.address, 4)}</a> : "—"}</div>
      <div className="font-mono text-[10px] text-mute">SOL {trader.solana ? <a href={explorerWallet("solana", trader.solana)} target="_blank" rel="noreferrer">{shortAddr(trader.solana, 4)}</a> : "—"}</div>
      {trader.smartReasons[0] ? <div className="mt-1 text-[10px] text-mute">{trader.smartReasons[0]}</div> : null}
    </article>
  );
}
