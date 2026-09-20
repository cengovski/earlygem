import Link from "next/link";
import { ago, usd } from "@/lib/format";
import type { Gem } from "@/lib/types";
import { ChainBadge } from "./Badge";

export function GemCard({ gem }: { gem: Gem }) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/token/${gem.chain}/${gem.token}`} className="text-lg font-semibold hover:text-accent">{gem.symbol}</Link>
          <div className="text-xs text-mute">{gem.name}</div>
        </div>
        <div className="text-right">
          <div className="num text-xl font-medium text-accent">{gem.score}</div>
          <div className="text-[10px] uppercase tracking-wider text-mute">erken skor</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ChainBadge chain={gem.chain} />
        <span className="num text-xs text-mute">mcap {usd(gem.mcap)}</span>
        <span className="num text-xs text-mute">lp {usd(gem.liquidity)}</span>
      </div>
      <ul className="mt-3 flex flex-1 flex-col gap-1 text-xs text-mute">
        {gem.reasons.slice(0, 3).map((r) => <li key={r}>· {r}</li>)}
      </ul>
      <div className="mt-3 flex items-center justify-between text-[11px] text-mute">
        <span>{gem.buyers} alici · {ago(gem.pairCreatedAt)}</span>
        {gem.pairUrl ? <a href={gem.pairUrl} target="_blank" rel="noreferrer" className="hover:text-accent">DexScreener</a> : null}
      </div>
    </article>
  );
}
