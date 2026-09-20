import Link from "next/link";
import { ago, compact, usd } from "@/lib/format";
import type { Gem } from "@/lib/types";
import { ChainBadge, SmartBadge } from "./Badge";
import { TokenLinks } from "./TokenLinks";

export function GemCard({ gem }: { gem: Gem }) {
  const watched = gem.smartBuyers.filter((b) => b.kind === "kol" || b.kind === "smart").slice(0, 4);
  const dexOnly = gem.chain !== "robinhood" || watched.length === 0;
  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/token/${gem.chain}/${gem.token}`} className="text-lg font-semibold hover:text-accent">
            {gem.symbol}
          </Link>
          <div className="text-xs text-mute">{gem.name}</div>
        </div>
        <div className="text-right">
          <div className="num text-xl font-medium text-accent">{gem.score}</div>
          <div className="text-[10px] uppercase tracking-wider text-mute">{dexOnly ? "dex" : "radar"}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ChainBadge chain={gem.chain} />
        {gem.launchpad ? (
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-mute">
            {gem.launchpad}
          </span>
        ) : null}
        {gem.securityOk ? (
          <span className="rounded-md bg-[#1c2a16] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#9adf6a]">
            GMGN OK
          </span>
        ) : gem.honeypot ? (
          <span className="rounded-md bg-[#2a1616] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#e07a7a]">
            honeypot
          </span>
        ) : (
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-mute">
            taranmadı
          </span>
        )}
        {gem.kolCount ? <SmartBadge kind="kol" /> : null}
        {gem.smartCount ? <SmartBadge kind="smart" /> : null}
        <span className="num text-xs text-mute">mcap {usd(gem.mcap)}</span>
        <span className="num text-xs text-mute">lp {usd(gem.liquidity)}</span>
      </div>
      {watched.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {watched.map((b) => (
            <Link
              key={b.handle}
              href={`/find?q=${encodeURIComponent(b.handle)}`}
              className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-mute hover:text-accent"
            >
              @{b.handle}
              {b.rank ? <span className="ml-1 font-mono text-[10px]">#{b.rank}</span> : null}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-mute">
          {gem.chain === "robinhood"
            ? "Bu token için tape alış yok."
            : `${gem.chain.toUpperCase()} Dex izleme — bu ağda FOMO handle tape yok.`}
        </p>
      )}
      <ul className="mt-3 flex flex-1 flex-col gap-1 text-xs text-mute">
        {gem.reasons.slice(0, 3).map((r) => (
          <li key={r}>· {r}</li>
        ))}
      </ul>
      <div className="mt-3 text-[11px] text-mute">
        {gem.kolCount + gem.smartCount} smart · {compact(gem.buyers)} alıcı
        {gem.lastSmartTs ? ` · ${ago(gem.lastSmartTs)}` : gem.pairCreatedAt ? ` · ${ago(gem.pairCreatedAt)}` : ""}
      </div>
      <div className="mt-3">
        <TokenLinks chain={gem.chain} address={gem.token} pairUrl={gem.pairUrl} />
      </div>
    </article>
  );
}
