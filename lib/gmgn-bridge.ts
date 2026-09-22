import { ingestPool } from "./pool";
import { logEvent } from "./log";
import type { ChainId, SmartKind, TapeFill } from "./types";
import { WINDOW_MIN } from "./window";

const EG_ORIGINS = new Set([
  "https://gmgn.ai",
  "https://www.gmgn.ai",
  "https://app.gmgn.ai",
]);

function chainOf(raw: string | undefined): ChainId {
  const s = (raw || "").toLowerCase();
  if (s === "sol" || s === "solana") return "solana";
  if (s === "bsc" || s === "bnb") return "bsc";
  if (s === "base") return "base";
  if (s === "eth" || s === "ethereum") return "ethereum";
  if (s === "rh" || s === "robinhood") return "robinhood";
  if (s === "monad") return "monad";
  return "solana";
}

function asFill(row: Record<string, unknown>): TapeFill | null {
  const side = String(row.side || "").toLowerCase();
  if (side !== "buy" && side !== "sell") return null;
  const token = String(row.token || "");
  if (!token) return null;
  const ts = Number(row.ts || 0);
  if (!ts) return null;
  const flags = Array.isArray(row.flags) ? row.flags.map(String) : ["gmgn", "follow", "track"];
  if (!flags.includes("follow")) flags.push("follow");
  if (!flags.includes("gmgn")) flags.push("gmgn");
  return {
    id: String(row.id || `gmgn-live-${row.tx || token}-${ts}`),
    ts,
    chain: chainOf(String(row.chain || "")),
    side: side === "sell" ? "sell" : "buy",
    usd: Number(row.usd || 0),
    amount: Number(row.amount || 0),
    price: row.price == null ? null : Number(row.price) || null,
    token,
    symbol: String(row.symbol || "???").trim(),
    name: String(row.name || row.symbol || "???").trim(),
    mcap: row.mcap == null ? null : Number(row.mcap) || null,
    liquidity: null,
    change24: null,
    pairUrl: row.pairUrl ? String(row.pairUrl) : null,
    imageUrl: row.imageUrl ? String(row.imageUrl) : null,
    wallet: row.wallet ? String(row.wallet) : null,
    handle: row.handle ? String(row.handle) : "wallet",
    followers: null,
    profileUrl: row.profileUrl ? String(row.profileUrl) : null,
    rank: null,
    tx: row.tx ? String(row.tx) : null,
    firstBuy: false,
    flags,
    source: "dexscreener",
    smartKind: (row.smartKind as SmartKind) || "smart",
  };
}

export function ingestGmgnTrackPayload(raw: unknown) {
  const rows = Array.isArray(raw) ? raw : [];
  const fills = rows.map((r) => (r && typeof r === "object" ? asFill(r as Record<string, unknown>) : null)).filter(Boolean) as TapeFill[];
  if (!fills.length) return 0;
  ingestPool(fills, WINDOW_MIN);
  logEvent({
    level: "info",
    event: "gmgn_follow",
    outcome: "ok",
    source: "gmgn",
    count: fills.length,
    detail: `track köprü ${fills.length} fill`,
  });
  window.dispatchEvent(new Event("eg-gmgn-track"));
  return fills.length;
}

let hooked = false;
export function installGmgnTrackBridge() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.name = "earlygem";
  window.addEventListener("message", (ev) => {
    if (!EG_ORIGINS.has(ev.origin)) return;
    const data = ev.data as { type?: string; fills?: unknown };
    if (data?.type !== "eg-gmgn-track") return;
    ingestGmgnTrackPayload(data.fills);
  });
}
