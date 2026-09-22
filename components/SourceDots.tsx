"use client";

import { gmgnFollowConfigured } from "@/lib/gmgn";
import { sourceStatus } from "@/lib/health";
import { useRadar } from "./RadarProvider";

export function SourceDots() {
  const { logs } = useRadar();
  const follow = gmgnFollowConfigured();
  const rows = sourceStatus(logs).filter((row) => !follow || (row.key !== "gmgn_kol" && row.key !== "gmgn_smart"));
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {rows.map((row) => (
        <span key={row.key} className="inline-flex items-center gap-1 text-mute" title={`${row.label} ${row.seen ? row.count : "yok"}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${row.ok ? "bg-[#7dff8a]" : row.seen ? "bg-[#ff5a5a]" : "bg-[#5a574c]"}`} />
          {row.label}
        </span>
      ))}
    </div>
  );
}
