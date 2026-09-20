import type { LogEvent } from "./log";

export const SOURCE_LABELS = [
  { key: "pulse", label: "Pulse" },
  { key: "gmgn_kol", label: "GMGN KOL" },
  { key: "gmgn_smart", label: "GMGN SM" },
  { key: "pumpfun", label: "Pump" },
  { key: "axiom", label: "Axiom" },
  { key: "binance", label: "Binance" },
  { key: "dex", label: "Dex" },
] as const;

export type SourceKey = (typeof SOURCE_LABELS)[number]["key"];

export function sourceStatus(logs: LogEvent[]) {
  return SOURCE_LABELS.map((row) => {
    const hit = logs.find((l) => l.event === "source" && l.detail === row.key);
    return {
      ...row,
      ok: hit ? hit.outcome === "ok" : false,
      seen: Boolean(hit),
      count: hit?.count ?? 0,
    };
  });
}
