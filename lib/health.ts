import { logEvent, type LogEvent } from "./log";
import type { TapeFill, Trader } from "./types";

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

export function markSource(key: SourceKey, ok: boolean, count = 0) {
  logEvent({
    level: ok ? "info" : "warn",
    event: "source",
    outcome: ok ? "ok" : "empty",
    count,
    detail: key,
  });
}

export function markFeeds(fills: TapeFill[], traders: Trader[]) {
  const flag = (name: string) => fills.filter((f) => f.flags.includes(name)).length;
  const src = (name: string) => traders.filter((t) => t.smartReasons.includes(`src:${name}`)).length;
  markSource("gmgn_kol", flag("kol") + src("gmgn") > 0, flag("kol"));
  markSource("gmgn_smart", flag("smart") > 0, flag("smart"));
  markSource("axiom", flag("axiom") + src("axiom") > 0, flag("axiom") + src("axiom"));
  markSource("pumpfun", src("pumpfun") > 0, src("pumpfun"));
  markSource("binance", flag("binance") + src("binance") > 0, flag("binance") + src("binance"));
}

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
