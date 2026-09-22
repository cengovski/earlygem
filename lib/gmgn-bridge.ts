import { detectDexChains, resolveGmgnChain } from "./gmgn-chain";
import { markSource } from "./health";
import { ingestPool, readPool } from "./pool";
import { logEvent } from "./log";
import { fillKey } from "./tape-key";
import type { SmartKind, TapeFill } from "./types";
import { WINDOW_MIN } from "./window";

const EG_ORIGINS = new Set([
  "https://gmgn.ai",
  "https://www.gmgn.ai",
  "https://app.gmgn.ai",
]);

function noteGmgn(line: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("eg-gmgn-log", { detail: line }));
}

type Draft = { fill: TapeFill; lock: boolean; raw: string };

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

function asFill(row: Record<string, unknown>): Draft | null {
  const side = String(row.side || "").toLowerCase();
  if (side !== "buy" && side !== "sell") return null;
  const token = String(row.token || "");
  if (!token) return null;
  const ts = Number(row.ts || 0);
  if (!ts) return null;
  const raw = String(row.chainRaw || row.n || "");
  const locked = resolveGmgnChain(raw);
  const fromPage = Boolean(row.fromPage) && !row.guessed ? resolveGmgnChain(String(row.chain || "")) : null;
  const chain = locked || fromPage || (token.startsWith("0x") || token.startsWith("0X") ? "unknown" : "solana");
  const flags = Array.isArray(row.flags) ? row.flags.map(String) : ["gmgn", "follow", "track"];
  if (!flags.includes("follow")) flags.push("follow");
  if (!flags.includes("gmgn")) flags.push("gmgn");
  if (locked || fromPage) flags.push("chain-locked");
  const tx = row.tx ? String(row.tx) : "";
  return {
    lock: Boolean(locked),
    raw,
    fill: {
      id: String(row.id || `gmgn-live-${tx || "x"}-${token}-${ts}`),
      ts,
      chain,
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
      tx: tx || null,
      firstBuy: Boolean(row.firstBuy) || Number(row.ooc) === 1,
      flags,
      source: "dexscreener",
      smartKind: (row.smartKind as SmartKind) || "smart",
    },
  };
}

export function isGmgnOverlayPaste(raw: string) {
  return /__egGmgnHooked|__egFollow\d|function asFollowTrade|function formRelay|function pageCopy|v5\.\d overlay/.test(raw);
}

export async function ingestGmgnPaste(raw: unknown): Promise<{ buys: number; hint: string }> {
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
  const n = await ingestGmgnTrackPayload(payload);
  if (n) return { buys: n, hint: `${n} buy 20dk havuza yazıldı` };
  return { buys: 0, hint: "JSON değil — {\"type\":\"eg-gmgn-track\",\"fills\":[...]} veya dump yapıştır" };
}

async function commitGmgnFills(raw: unknown) {
  const rows = parseGmgnTrackFills(raw);
  const drafts = rows.map((r) => asFill(r)).filter(Boolean) as Draft[];
  if (!drafts.length) return 0;
  const open = drafts.filter((d) => !d.lock);
  if (open.length) {
    const detected = await detectDexChains(open.map((d) => d.fill.token));
    for (const draft of open) {
      const hit = detected.get(draft.fill.token.toLowerCase());
      if (!hit) continue;
      draft.fill = { ...draft.fill, chain: hit, flags: [...new Set([...draft.fill.flags, "chain-locked"])] };
      draft.lock = true;
    }
  }
  const fills = drafts.map((d) => d.fill);
  const before = new Set(readPool(WINDOW_MIN).map((row) => fillKey(row)));
  ingestPool(fills, WINDOW_MIN);
  const fresh = readPool(WINDOW_MIN).filter((row) => !before.has(fillKey(row)) && row.side === "buy");
  const summary = drafts
    .filter((d) => d.fill.side === "buy")
    .map((d) => `${d.fill.symbol} ${d.fill.chain}${d.raw ? `/${d.raw}` : ""}`)
    .join(", ");
  noteGmgn(fresh.length ? `havuz +${fresh.length}: ${summary}` : `havuz 0 yeni: ${summary}`);
  if (!fresh.length) return 0;
  logEvent({
    level: "info",
    event: "gmgn_follow",
    outcome: "ok",
    source: "gmgn",
    count: fresh.length,
    detail: `track ${fresh.length}/${fills.length} ${summary}`.slice(0, 240),
  });
  markSource("gmgn_follow", true, fresh.length);
  window.dispatchEvent(new Event("eg-gmgn-track"));
  return fresh.length;
}

let ingestTail = Promise.resolve();

export function ingestGmgnTrackPayload(raw: unknown) {
  const run = ingestTail.then(() => commitGmgnFills(raw));
  ingestTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
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
    return await ingestGmgnTrackPayload(text);
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
    return await ingestGmgnTrackPayload(json.fills || []);
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
    const data = ev.data as { type?: string; fills?: unknown; line?: string };
    if (data?.type === "eg-gmgn-track-log") {
      if (data.line) noteGmgn(String(data.line));
      return;
    }
    if (data?.type !== "eg-gmgn-track") return;
    void ingestGmgnTrackPayload(data.fills).then((buys) => {
      try {
        const src = ev.source as Window | null;
        if (src) src.postMessage({ type: "eg-gmgn-track-ack", count: buys }, ev.origin);
      } catch {
        /* gmgn may already have navigated */
      }
    });
  });
}
