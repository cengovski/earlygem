import Link from "next/link";
import { SmartBadge } from "@/components/Badge";
import { Shell } from "@/components/Shell";
import { compact, shortAddr, usd } from "@/lib/format";
import { fetchRadarBundle } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function TradersPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const { traders } = await fetchRadarBundle();
  const rows =
    kind === "kol"
      ? traders.filter((t) => t.kind === "kol")
      : kind === "smart"
        ? traders.filter((t) => t.kind === "kol" || t.kind === "smart")
        : traders;

  return (
    <Shell title="Smart / KOL roster" subtitle="Takipçi + tape rank + hacim + tur galibiyeti. Pulse boşsa tape'den türetilir.">
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/traders" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">hepsi</Link>
        <Link href="/traders?kind=smart" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">smart + KOL</Link>
        <Link href="/traders?kind=kol" className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">sadece KOL</Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-[#18160f] text-[11px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">handle</th>
              <th className="px-3 py-2">sınıf</th>
              <th className="px-3 py-2">EVM tape</th>
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
                <td colSpan={10} className="px-3 py-8 text-sm text-mute">Roster boş. Üstten yenile veya Log.</td>
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
                <td className="px-3 py-2 font-mono text-xs text-mute">{shortAddr(t.address, 4)}</td>
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
    </Shell>
  );
}
