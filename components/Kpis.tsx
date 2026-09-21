import { usd, compact } from "@/lib/format";
import type { PulseStatus } from "@/lib/types";

export function Kpis({ status, extra }: { status: PulseStatus | null; extra?: { label: string; value: string }[] }) {
  const items = [
    { label: "RH 24s hacim", value: status ? usd(status.volume24h) : "—" },
    { label: "RH fill", value: status ? compact(status.fills24h) : "—" },
    { label: "izlenen cuzdan", value: status ? compact(status.wallets) : "—" },
    { label: "lag", value: status ? `${status.lagSeconds}s` : "—" },
    ...(extra || []),
  ];
  return (
    <section className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
      {items.map((k) => (
        <div key={k.label} className="rounded-xl border border-line bg-surface px-3 py-3">
          <div className="text-[11px] uppercase tracking-wider text-mute">{k.label}</div>
          <div className="num mt-1 text-lg font-medium">{k.value}</div>
        </div>
      ))}
    </section>
  );
}
