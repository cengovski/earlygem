import Link from "next/link";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { recentLogs } from "@/lib/log";
import { fetchPulseStatus, fetchPulseTape, fetchPulseTraders, fetchSolanaGems } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const [status, traders, tape, dex] = await Promise.all([
    fetchPulseStatus(),
    fetchPulseTraders(),
    fetchPulseTape(30),
    fetchSolanaGems(),
  ]);
  const logs = recentLogs(40);
  return (
    <Shell title="Kaynak log" subtitle="Bu istekte yapılan fetch'ler. JSON: /api/debug">
      <div className="mb-4 flex items-center gap-3">
        <RefreshButton />
        <Link href="/api/debug" className="text-sm text-mute hover:text-accent">/api/debug JSON</Link>
      </div>
      <div className="mb-6 grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-3 text-sm">pulse {status ? "ok" : "yok"} · lag {status?.lagSeconds ?? "—"}s</div>
        <div className="rounded-xl border border-line bg-surface p-3 text-sm">trader {traders.length}</div>
        <div className="rounded-xl border border-line bg-surface p-3 text-sm">tape {tape.length}</div>
        <div className="rounded-xl border border-line bg-surface p-3 text-sm">sol/base {dex.length}</div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-[720px] w-full text-left text-xs">
          <thead className="bg-[#18160f] text-[11px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-3 py-2">zaman</th>
              <th className="px-3 py-2">lvl</th>
              <th className="px-3 py-2">event</th>
              <th className="px-3 py-2">sonuç</th>
              <th className="px-3 py-2">ms</th>
              <th className="px-3 py-2">n</th>
              <th className="px-3 py-2">detay</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row, i) => (
              <tr key={`${row.ts}-${i}`} className="border-t border-line">
                <td className="num px-3 py-2 text-mute">{row.ts.slice(11, 19)}</td>
                <td className="px-3 py-2">{row.level}</td>
                <td className="px-3 py-2">{row.event}</td>
                <td className="px-3 py-2">{row.outcome}</td>
                <td className="num px-3 py-2">{row.ms ?? "—"}</td>
                <td className="num px-3 py-2">{row.count ?? "—"}</td>
                <td className="px-3 py-2 text-mute">{row.detail || row.status || row.url || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
