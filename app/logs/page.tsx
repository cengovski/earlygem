"use client";

import { useEffect, useMemo, useState } from "react";
import { PulseGate } from "@/components/PulseGate";
import { RefreshButton } from "@/components/RefreshButton";
import { Shell } from "@/components/Shell";
import { useRadar } from "@/components/RadarProvider";
import { clearFaults, formatFaultReport, isFault, recentFaults, type LogEvent } from "@/lib/log";

function kindLabel(row: LogEvent) {
  return row.kind || (row.outcome === "denied" ? "api" : row.level);
}

export default function LogsPage() {
  const { logs } = useRadar();
  const [copied, setCopied] = useState("");
  const [stored, setStored] = useState<LogEvent[]>([]);
  useEffect(() => {
    setStored(recentFaults(80));
  }, [logs]);
  const faults = useMemo(() => {
    const live = logs.filter(isFault);
    const seen = new Set(live.map((r) => `${r.ts}|${r.event}|${r.url}|${r.detail}`));
    return [...live, ...stored.filter((r) => !seen.has(`${r.ts}|${r.event}|${r.url}|${r.detail}`))];
  }, [logs, stored]);
  const live = logs.filter((row) => row.event !== "source" || row.outcome !== "empty" || row.detail === "pulse");

  async function copyReport() {
    const text = formatFaultReport();
    try {
      await navigator.clipboard.writeText(text);
      setCopied("kopyalandı — buraya yapıştır");
    } catch {
      setCopied("kopya yok, raporu seçip kopyala");
    }
  }

  return (
    <Shell
      title="Kaynak log"
      subtitle="Bağlantı ve API arızaları bu sekmede birikir. Raporu kopyalayıp bana yapıştır, kaynağı düzeltirim."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <RefreshButton label="zorla yenile" />
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]"
          onClick={() => void copyReport()}
        >
          arıza raporunu kopyala
        </button>
        <button
          type="button"
          className="rounded-md border border-line px-3 py-1 text-sm"
          onClick={() => {
            clearFaults();
            setCopied("arıza kaydı silindi");
          }}
        >
          arızaları sil
        </button>
        {copied ? <span className="text-xs text-accent">{copied}</span> : null}
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
              <div className="rounded-xl border border-line bg-surface p-3 text-sm">arıza {faults.length}</div>
            </div>
          </>
        )}
      </PulseGate>

      <h2 className="mb-2 text-sm font-medium">Arızalar (bağlantı / API)</h2>
      {!faults.length ? (
        <p className="mb-6 rounded-xl border border-line bg-surface px-3 py-4 text-sm text-mute">
          Kayıtlı bağlantı veya API arızası yok. Bir kaynak 401, timeout, CORS veya ağ hatası verince buraya düşer.
        </p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-xl border border-[#5a2a24]">
          <table className="min-w-[720px] w-full text-left text-xs">
            <thead className="bg-[#2a1814] text-[11px] uppercase tracking-wider text-mute">
              <tr>
                <th className="px-3 py-2">zaman</th>
                <th className="px-3 py-2">tür</th>
                <th className="px-3 py-2">kaynak</th>
                <th className="px-3 py-2">event</th>
                <th className="px-3 py-2">http</th>
                <th className="px-3 py-2">ms</th>
                <th className="px-3 py-2">detay</th>
              </tr>
            </thead>
            <tbody>
              {faults.map((row, i) => (
                <tr key={`${row.ts}-f-${i}`} className="border-t border-line">
                  <td className="num px-3 py-2 text-mute">{row.ts.slice(11, 19)}</td>
                  <td className="px-3 py-2 text-[#ff6b5b]">{kindLabel(row)}</td>
                  <td className="px-3 py-2">{row.source || "—"}</td>
                  <td className="px-3 py-2">{row.event}</td>
                  <td className="num px-3 py-2">{row.status ?? "—"}</td>
                  <td className="num px-3 py-2">{row.ms ?? "—"}</td>
                  <td className="px-3 py-2 text-mute">{row.detail || row.url || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium">Tüm fetch</h2>
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
            {!live.length ? (
              <tr>
                <td className="px-3 py-4 text-mute" colSpan={7}>
                  Bu turda henüz fetch yok. Yenile, kaynaklar buraya düşer.
                </td>
              </tr>
            ) : (
              live.map((row, i) => (
                <tr key={`${row.ts}-${i}`} className={`border-t border-line ${isFault(row) ? "bg-[#241714]" : ""}`}>
                  <td className="num px-3 py-2 text-mute">{row.ts.slice(11, 19)}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">{row.event}</td>
                  <td className="px-3 py-2">{row.outcome}</td>
                  <td className="num px-3 py-2">{row.ms ?? "—"}</td>
                  <td className="num px-3 py-2">{row.count ?? "—"}</td>
                  <td className="px-3 py-2 text-mute">{row.detail || row.status || row.url || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
