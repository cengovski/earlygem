import Link from "next/link";
import { ago, compact, shortAddr, usd } from "@/lib/format";
import type { TapeFill } from "@/lib/types";
import { ChainBadge, SideBadge, SmartBadge } from "./Badge";
import { TokenLinks } from "./TokenLinks";

export function TapeTable({ rows }: { rows: TapeFill[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-sm text-mute">
        Tape şu an boş. fomopulse.app yanıt vermiyor olabilir — sayfayı yenile.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-[980px] w-full text-left text-sm">
        <thead className="bg-[#18160f] text-[11px] uppercase tracking-wider text-mute">
          <tr>
            <th className="px-3 py-2 font-medium">zaman</th>
            <th className="px-3 py-2 font-medium">zincir</th>
            <th className="px-3 py-2 font-medium">yön</th>
            <th className="px-3 py-2 font-medium">token</th>
            <th className="px-3 py-2 font-medium">boyut</th>
            <th className="px-3 py-2 font-medium">mcap</th>
            <th className="px-3 py-2 font-medium">trader</th>
            <th className="px-3 py-2 font-medium">bağlantı</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="tape-row border-t border-line">
              <td className="num px-3 py-2 text-mute">{ago(r.ts)}</td>
              <td className="px-3 py-2">
                <ChainBadge chain={r.chain} />
              </td>
              <td className="px-3 py-2">
                <SideBadge side={r.side} />
              </td>
              <td className="px-3 py-2">
                <Link href={`/token/${r.chain}/${r.token}`} className="font-medium hover:text-accent">
                  {r.symbol}
                </Link>
                {r.firstBuy ? (
                  <span className="ml-2 rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] text-[#16140c]">
                    FIRST
                  </span>
                ) : null}
                <div className="text-[11px] text-mute">{r.name}</div>
              </td>
              <td className="num px-3 py-2">{usd(r.usd)}</td>
              <td className="num px-3 py-2 text-mute">{usd(r.mcap)}</td>
              <td className="px-3 py-2">
                {r.handle ? (
                  <a href={r.profileUrl || `https://fomo.family/profile/${r.handle}`} className="hover:text-accent">
                    @{r.handle}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-mute">{shortAddr(r.wallet)}</span>
                )}
                <div className="mt-0.5 flex items-center gap-1">
                  <SmartBadge kind={r.smartKind} />
                  {r.followers ? <span className="text-[11px] text-mute">{compact(r.followers)} flw</span> : null}
                </div>
              </td>
              <td className="px-3 py-2 text-xs">
                <TokenLinks chain={r.chain} address={r.token} pairUrl={r.pairUrl} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
