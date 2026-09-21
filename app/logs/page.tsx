"use client";

import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { useRadar } from "@/components/RadarProvider";

export default function LogsPage() {
  const { logs } = useRadar();
  const live = logs.filter((row) => row.event !== "source" || row.outcome !== "empty" || row.detail === "pulse");
  return (
    <Shell title="Kaynak log" subtitle="Bu sekmede tarayıcının yaptığı fetch'ler. Pulse worker'a senin IP'den gider.">
      <div className="mb-4 flex items-center gap-3">
        <RefreshButton label="zorla yenile" />
      </div>
      <PulseGate>
        {(bundle) => (
          <>
            <div className="mb-4 text-xs text-mute">
              {bundle.meta.fetchedAt} · traders={bundle.meta.tradersSource} · cache={String(bundle.meta.fromCache)} ·{" "}
              {bundle.meta.errors.filter((e) => e !== "traders_seeded_known").join(" · ") || "hata yok"}
            </div>
            <div className="mb-6 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-line bg-surface p-3 text-sm">
                pulse {bundle.status ? "ok" : "yok"} · lag {bundle.status?.lagSeconds ?? "—"}s
              </div>
              <div className="rounded-xl border border-line bg-surface p-3 text-sm">trader {bundle.traders.length}</div>
              <div className="rounded-xl border border-line bg-surface p-3 text-sm">tape {bundle.tape.length}</div>
              <div className="rounded-xl border border-line bg-surface p-3 text-sm">sol/base {bundle.dexWatch.length}</div>
            </div>
          </>
        )}
      </PulseGate>
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
            {live.map((row, i) => (
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
