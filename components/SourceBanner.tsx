import type { RadarMeta } from "@/lib/store";
import { RefreshButton } from "./RefreshButton";

export function SourceBanner({ meta }: { meta: RadarMeta }) {
  if (meta.pulseOk && !meta.errors.length) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-mute">
      <div>
        {meta.pulseOk ? "Kaynak uyarı: " : "Pulse zayıf: "}
        {meta.tradersSource === "tape" ? "traderlar tape’den türetildi. " : null}
        {meta.fallback ? "stale snapshot. " : null}
        {meta.errors.slice(0, 4).join(" · ") || "detay /logs"}
      </div>
      <RefreshButton label="zorla yenile" />
    </div>
  );
}
