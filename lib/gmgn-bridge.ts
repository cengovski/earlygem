import { markSource } from "./health";
import { ingestPool, readPool } from "./pool";
import { logEvent } from "./log";
import type { ChainId, SmartKind, TapeFill } from "./types";
import { WINDOW_MIN } from "./window";

const EG_ORIGINS = new Set([
  "https://gmgn.ai",
  "https://www.gmgn.ai",
  "https://app.gmgn.ai",
]);

function chainOf(raw: string | undefined, token = ""): ChainId {
  const s = (raw || "").toLowerCase();
  if (s === "sol" || s === "solana") return "solana";
  if (s === "bsc" || s === "bnb") return "bsc";
  if (s === "base") return "base";
  if (s === "eth" || s === "ethereum") return "ethereum";
  if (s === "rh" || s === "robinhood") return "robinhood";
  if (s === "monad") return "monad";
  if (String(token).startsWith("0x")) return "ethereum";
  return "solana";
}

export function parseGmgnTrackFills(raw: unknown): Record<string, unknown>[] {
  let data: unknown = raw;
  if (typeof data === "string") {
    const text = data.trim();
    if (!text) return [];
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }
  }
  if (Array.isArray(data)) {
    return data.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const list = obj.fills ?? obj.trades;
    if (Array.isArray(list)) {
      return list.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
    }
  }
  return [];
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
    chain: chainOf(String(row.chain || ""), token),
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
    firstBuy: Boolean(row.firstBuy) || Number(row.ooc) === 1,
    flags,
    source: "dexscreener",
    smartKind: (row.smartKind as SmartKind) || "smart",
  };
}

export function isGmgnOverlayPaste(raw: string) {
  return /__egGmgnHooked|__egFollow\d|function asFollowTrade|function formRelay|function pageCopy|v5\.\d overlay/.test(raw);
}

export function ingestGmgnPaste(raw: unknown): { buys: number; hint: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text && isGmgnOverlayPaste(text)) {
    return {
      buys: 0,
      hint: "Bu F12 overlay — gmgn Track console’a yapıştır (YENİLEME). Bu kutu buy JSON: sarı kutu veya __egGmgn.dump()",
    };
  }
  let payload: unknown = raw;
  if (text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start && (start > 0 || end < text.length - 1)) {
      payload = text.slice(start, end + 1);
    }
  }
  const n = ingestGmgnTrackPayload(payload);
  if (n) return { buys: n, hint: `${n} buy 20dk havuza yazıldı` };
  return { buys: 0, hint: "JSON değil — {\"type\":\"eg-gmgn-track\",\"fills\":[...]} veya dump yapıştır" };
}

export function ingestGmgnTrackPayload(raw: unknown) {
  const rows = parseGmgnTrackFills(raw);
  const fills = rows.map((r) => asFill(r)).filter(Boolean) as TapeFill[];
  if (!fills.length) return 0;
  const before = new Set(readPool(WINDOW_MIN).map((row) => row.tx || row.id));
  ingestPool(fills, WINDOW_MIN);
  const buys = readPool(WINDOW_MIN).filter((row) => !before.has(row.tx || row.id) && row.side === "buy").length;
  if (!buys) return 0;
  logEvent({
    level: "info",
    event: "gmgn_follow",
    outcome: "ok",
    source: "gmgn",
    count: buys,
    detail: `track köprü ${buys} buy / ${fills.length} fill`,
  });
  markSource("gmgn_follow", true, buys);
  window.dispatchEvent(new Event("eg-gmgn-track"));
  return buys;
}

let lastClipAt = 0;

export async function ingestGmgnClipboard() {
  if (typeof window === "undefined" || !navigator.clipboard?.readText) return 0;
  const now = Date.now();
  if (now - lastClipAt < 1500) return 0;
  lastClipAt = now;
  try {
    const text = await navigator.clipboard.readText();
    if (isGmgnOverlayPaste(text)) return 0;
    if (!/eg-gmgn-track|"follow"/.test(text)) return 0;
    return ingestGmgnTrackPayload(text);
  } catch {
    return 0;
  }
}

let ingestSince = Date.now() - 20 * 60_000;

export async function pullGmgnIngest() {
  if (typeof window === "undefined") return 0;
  try {
    const res = await fetch(`/api/gmgn-ingest?since=${ingestSince}`, { cache: "no-store" });
    if (!res.ok) return 0;
    const json = (await res.json()) as { fills?: unknown; until?: number };
    if (typeof json.until === "number") ingestSince = json.until;
    return ingestGmgnTrackPayload(json.fills || []);
  } catch {
    return 0;
  }
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
    const buys = ingestGmgnTrackPayload(data.fills);
    try {
      const src = ev.source as Window | null;
      if (src) src.postMessage({ type: "eg-gmgn-track-ack", count: buys }, ev.origin);
    } catch {
      /* gmgn may already have navigated */
    }
  });
}
