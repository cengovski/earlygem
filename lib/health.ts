import { gmgnCooling, gmgnFollowConfigured } from "./gmgn";
import { logEvent, type LogEvent } from "./log";
import type { TapeFill, Trader } from "./types";

export const SOURCE_LABELS = [
  { key: "pulse", label: "Pulse" },
  { key: "gmgn_kol", label: "GMGN KOL" },
  { key: "gmgn_smart", label: "GMGN SM" },
  { key: "cabalspy", label: "Cabal" },
  { key: "soltrack", label: "SolTrack" },
  { key: "madeonsol", label: "MadeOn" },
  { key: "bitquery", label: "Bitquery" },
  { key: "pumpfun", label: "Pump" },
  { key: "axiom", label: "Axiom" },
  { key: "binance", label: "Binance" },
  { key: "nansen", label: "Nansen" },
  { key: "gmgn_follow", label: "GMGN Follow" },
  { key: "dex", label: "Dex" },
] as const;

export type SourceKey = (typeof SOURCE_LABELS)[number]["key"];

const LAST = new Map<SourceKey, { ok: boolean; count: number; at: number }>();
const HOLD_MS = 15 * 60_000;

export function markSource(key: SourceKey, ok: boolean, count = 0) {
  if (ok) LAST.set(key, { ok: true, count, at: Date.now() });
  else {
    const prev = LAST.get(key);
    if (prev?.ok && Date.now() - prev.at < HOLD_MS) {
      logEvent({
        level: "info",
        event: "source",
        outcome: "ok",
        count: prev.count,
        detail: key,
      });
      return;
    }
  }
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
  const src = (name: string) => traders.filter((t) => t.smartReasons.some((s) => s.includes(name))).length;
  markSource("cabalspy", flag("cabalspy") + src("cabalspy") > 0, flag("cabalspy"));
  markSource("soltrack", flag("soltrack") + src("soltrack") > 0, flag("soltrack"));
  markSource("madeonsol", flag("madeonsol") + src("madeonsol") > 0, flag("madeonsol"));
  markSource("bitquery", flag("bitquery") + src("bitquery") > 0, flag("bitquery"));
  markSource("axiom", flag("axiom") + src("axiom") > 0, flag("axiom") + src("axiom"));
  markSource("pumpfun", src("pumpfun") > 0, src("pumpfun"));
  markSource("binance", flag("binance") + src("binance") > 0, flag("binance") + src("binance"));
  markSource("nansen", flag("nansen") + src("nansen") > 0, flag("nansen") + src("nansen"));
  const followHits = flag("follow");
  if (followHits > 0) markSource("gmgn_follow", true, followHits);
  else if (!(gmgnFollowConfigured() && gmgnCooling())) markSource("gmgn_follow", false, 0);
  if (!gmgnFollowConfigured()) {
    markSource("gmgn_kol", flag("kol") + src("gmgn") > 0, flag("kol"));
    markSource("gmgn_smart", flag("smart") > 0, flag("smart"));
  }
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
