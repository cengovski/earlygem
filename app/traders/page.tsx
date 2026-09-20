import Link from "next/link";
import { Shell } from "@/components/Shell";
import { compact, shortAddr, usd } from "@/lib/format";
import { fetchPulseTraders } from "@/lib/sources";

export const revalidate = 30;

export default async function TradersPage() {
  const traders = await fetchPulseTraders();
  return (
    <Shell title="Izlenen traderlar" subtitle="fomopulse evreni. Win = tape turlari, FOMO app PnL degil.">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="bg-[#18160f] text-[11px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-3 py-2">#</th><th className="px-3 py-2">handle</th><th className="px-3 py-2">EVM</th>
              <th className="px-3 py-2">realized</th><th className="px-3 py-2">open</th><th className="px-3 py-2">fills</th>
              <th className="px-3 py-2">win</th><th className="px-3 py-2">flw</th>
            </tr>
          </thead>
          <tbody>
            {traders.map((t, i) => (
              <tr key={t.handle} className="tape-row border-t border-line">
                <td className="num px-3 py-2 text-mute">{t.rank ?? i + 1}</td>
                <td className="px-3 py-2"><Link href={`/find?q=${encodeURIComponent(t.handle)}`} className="font-medium hover:text-accent">@{t.handle}</Link></td>
                <td className="px-3 py-2 font-mono text-xs text-mute">{shortAddr(t.address, 4)}</td>
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
    </Shell>
  );
}
